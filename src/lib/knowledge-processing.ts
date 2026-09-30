import { get } from "@vercel/blob";
import mammoth from "mammoth";
import OpenAI from "openai";
import pdf from "pdf-parse/lib/pdf-parse";
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

function vectorLiteral(embedding: number[]) {
  if (embedding.length !== 1_536 || embedding.some((value) => !Number.isFinite(value))) throw new Error("Embedding service returned an invalid vector.");
  return `[${embedding.join(",")}]`;
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

    await db.$transaction(async (transaction) => {
      await transaction.knowledgeChunk.deleteMany({ where: { documentId: document.id } });
      await transaction.knowledgeChunk.createMany({ data: chunks.map((content, sequence) => ({ documentId: document.id, sequence, content, embedding: embeddings.data[sequence].embedding })) });
      for (const [sequence, item] of embeddings.data.entries()) {
        await transaction.$executeRaw`UPDATE "KnowledgeChunk" SET "embeddingVector" = ${vectorLiteral(item.embedding)}::vector WHERE "documentId" = ${document.id}::uuid AND "sequence" = ${sequence}`;
      }
      await transaction.knowledgeDocument.update({ where: { id: document.id }, data: { status: "READY", chunkCount: chunks.length, processingError: null } });
    });
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

  type VectorSearchRow = { filename: string; content: string; score: number };
  const rows = await getDb().$queryRaw<VectorSearchRow[]>`
    SELECT document."filename", chunk."content",
      1 - (chunk."embeddingVector" <=> ${vectorLiteral(queryEmbedding)}::vector) AS score
    FROM "KnowledgeChunk" AS chunk
    INNER JOIN "KnowledgeDocument" AS document ON document."id" = chunk."documentId"
    INNER JOIN "CampaignKnowledge" AS assignment ON assignment."documentId" = document."id"
    WHERE assignment."campaignId" = ${campaignId}::uuid
      AND document."status" = 'READY'
      AND chunk."embeddingVector" IS NOT NULL
    ORDER BY chunk."embeddingVector" <=> ${vectorLiteral(queryEmbedding)}::vector
    LIMIT ${MAX_RETRIEVED_CHUNKS};
  `;
  return rows.filter((row) => Number(row.score) >= 0.2).map((row) => ({ ...row, score: Number(row.score) }));
}
