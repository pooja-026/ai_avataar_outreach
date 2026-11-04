import { get } from "@vercel/blob";
import mammoth from "mammoth";
import OpenAI from "openai";
import pdf from "pdf-parse/lib/pdf-parse";
import { getDb } from "@/lib/db";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 160;
const MAX_RETRIEVED_CHUNKS = 4;
const EMBEDDING_BATCH_SIZE = 96;
const DOCUMENT_CONCURRENCY = 2;
// Longer than the campaign page's maxDuration (300s), so a live worker is never reclaimed.
const STALE_PROCESSING_MS = 10 * 60 * 1000;

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

function claimableDocumentFilter() {
  // A PROCESSING document older than this was abandoned by a worker that hit
  // its time limit or crashed, so it is safe to claim again.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  return [
    { status: { in: ["UPLOADED", "FAILED"] as Array<"UPLOADED" | "FAILED"> } },
    { status: "PROCESSING" as const, OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: staleBefore } }] },
  ];
}

/**
 * Atomically marks a campaign's unprepared documents as PROCESSING and returns
 * the IDs this caller now owns. Two admins clicking "Prepare" at once cannot
 * both process the same document.
 */
export async function claimCampaignKnowledge(campaignId: string) {
  const db = getDb();
  const candidates = await db.campaignKnowledge.findMany({
    where: { campaignId, document: { OR: claimableDocumentFilter() } },
    select: { documentId: true },
  });
  const claimed: string[] = [];
  for (const { documentId } of candidates) {
    const { count } = await db.knowledgeDocument.updateMany({
      where: { id: documentId, OR: claimableDocumentFilter() },
      data: { status: "PROCESSING", processingStartedAt: new Date(), processingError: null, chunkCount: 0, processedChunkCount: 0 },
    });
    if (count) claimed.push(documentId);
  }
  return claimed;
}

async function insertChunkBatch(documentId: string, firstSequence: number, contents: string[], embeddings: number[][]) {
  const sequences = contents.map((_, index) => firstSequence + index);
  const vectors = embeddings.map(vectorLiteral);
  // One statement per batch instead of one UPDATE per chunk.
  await getDb().$executeRaw`
    INSERT INTO "KnowledgeChunk" ("id", "documentId", "sequence", "content", "embeddingVector", "updatedAt")
    SELECT gen_random_uuid(), ${documentId}::uuid, batch.sequence, batch.content, batch.vector::vector, NOW()
    FROM unnest(${sequences}::int[], ${contents}::text[], ${vectors}::text[]) AS batch(sequence, content, vector)
  `;
}

/** Prepares one already-claimed document. Never throws; failures are recorded on the document. */
export async function processKnowledgeDocument(documentId: string) {
  const db = getDb();
  const document = await db.knowledgeDocument.findUnique({ where: { id: documentId } });
  if (!document) return { ok: false as const };

  try {
    const text = await readDocument(document.blobUrl, document.contentType);
    const chunks = splitIntoChunks(text);
    if (!chunks.length) throw new Error("No readable text was found in this document.");

    await db.knowledgeChunk.deleteMany({ where: { documentId } });
    await db.knowledgeDocument.update({ where: { id: documentId }, data: { chunkCount: chunks.length, processedChunkCount: 0 } });

    const client = embeddingClient();
    const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      const response = await client.embeddings.create({ model, input: batch });
      const embeddings = [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
      if (embeddings.length !== batch.length) throw new Error("Embedding service returned incomplete data.");
      await insertChunkBatch(documentId, start, batch, embeddings);
      await db.knowledgeDocument.update({ where: { id: documentId }, data: { processedChunkCount: start + batch.length } });
    }

    await db.knowledgeDocument.update({ where: { id: documentId }, data: { status: "READY", processingError: null, processingStartedAt: null } });
    return { ok: true as const };
  } catch (error) {
    console.error("Knowledge document processing failed", { documentId, error: error instanceof Error ? error.name : "unknown" });
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "Document processing failed.";
    try {
      // Partial chunks are invisible to retrieval (only READY documents are searched), but remove them anyway.
      await db.knowledgeChunk.deleteMany({ where: { documentId } });
      await db.knowledgeDocument.update({ where: { id: documentId }, data: { status: "FAILED", processingError: message, processingStartedAt: null } });
    } catch {
      // The document may have been deleted while it was processing.
    }
    return { ok: false as const };
  }
}

/** Processes claimed documents with bounded concurrency to stay within embedding rate limits. */
export async function processKnowledgeDocuments(documentIds: string[]) {
  const queue = [...documentIds];
  let processed = 0;
  let failed = 0;
  const worker = async () => {
    for (let documentId = queue.shift(); documentId; documentId = queue.shift()) {
      if ((await processKnowledgeDocument(documentId)).ok) processed++;
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOCUMENT_CONCURRENCY, queue.length) }, worker));
  return { processed, failed };
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
