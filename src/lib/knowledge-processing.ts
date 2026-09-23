import { get } from "@vercel/blob";
import mammoth from "mammoth";
import OpenAI from "openai";
import pdf from "pdf-parse";
import { getDb } from "@/lib/db";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 160;
const MAX_RETRIEVED_CHUNKS = 4;

function cleanText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitIntoChunks(text: string) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK_SIZE);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end), text.lastIndexOf(" ", end));
      if (boundary > start + Math.floor(CHUNK_SIZE * 0.55)) end = boundary + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

function embeddingClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required to prepare RAG knowledge.");
  return new OpenAI({ apiKey });
}

async function readDocument(blobUrl: string, contentType: string) {
  const result = await get(blobUrl, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("Private document could not be read.");
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());

  if (contentType === "application/pdf") {
    return cleanText((await pdf(buffer)).text);
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return cleanText((await mammoth.extractRawText({ buffer })).value);
  }
  return cleanText(buffer.toString("utf8"));
}

function asEmbedding(value: unknown): number[] | null {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry)) ? value : null;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  return leftMagnitude && rightMagnitude ? dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)) : -1;
}

export async function processKnowledgeDocument(documentId: string) {
  const db = getDb();
  const document = await db.knowledgeDocument.findUnique({ where: { id: documentId } });
  if (!document) throw new Error("Knowledge document was not found.");

  await db.knowledgeDocument.update({ where: { id: document.id }, data: { status: "PROCESSING", processingError: null } });
  try {
    const text = await readDocument(document.blobUrl, document.contentType);
    const chunks = splitIntoChunks(text);
    if (!chunks.length) throw new Error("No readable text was found in this document.");

    const embeddings = await embeddingClient().embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: chunks,
    });
    if (embeddings.data.length !== chunks.length) throw new Error("Embedding service returned incomplete data.");

    await db.$transaction([
      db.knowledgeChunk.deleteMany({ where: { documentId: document.id } }),
      db.knowledgeChunk.createMany({ data: chunks.map((content, sequence) => ({ documentId: document.id, sequence, content, embedding: embeddings.data[sequence].embedding })) }),
      db.knowledgeDocument.update({ where: { id: document.id }, data: { status: "READY", chunkCount: chunks.length, processingError: null } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "Document processing failed.";
    await db.knowledgeDocument.update({ where: { id: document.id }, data: { status: "FAILED", processingError: message } });
    throw error;
  }
}

export async function processCampaignKnowledge(campaignId: string) {
  const documents = await getDb().campaignKnowledge.findMany({
    where: { campaignId, document: { status: { in: ["UPLOADED", "FAILED"] } } },
    select: { documentId: true },
  });
  const outcomes = await Promise.allSettled(documents.map(({ documentId }) => processKnowledgeDocument(documentId)));
  return { processed: outcomes.filter((outcome) => outcome.status === "fulfilled").length, failed: outcomes.filter((outcome) => outcome.status === "rejected").length };
}

export async function retrieveCampaignKnowledge(campaignId: string, question: string) {
  const query = cleanText(question);
  if (!query) return [];
  const queryEmbedding = (await embeddingClient().embeddings.create({ model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", input: query })).data[0]?.embedding;
  if (!queryEmbedding) return [];

  const knowledge = await getDb().campaignKnowledge.findMany({
    where: { campaignId, document: { status: "READY" } },
    select: { document: { select: { filename: true, chunks: { select: { id: true, content: true, embedding: true } } } } },
  });
  return knowledge.flatMap(({ document }) => document.chunks.map((chunk) => ({ filename: document.filename, content: chunk.content, score: cosineSimilarity(queryEmbedding, asEmbedding(chunk.embedding) || []) })))
    .filter((chunk) => chunk.score >= 0.2)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RETRIEVED_CHUNKS);
}
