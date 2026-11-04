-- Restore the pgvector HNSW index dropped by 20261103195502_knowledge_processing.
-- Prisma cannot represent HNSW indexes in schema.prisma, so `prisma migrate dev`
-- generates a DROP for it. Always remove that DROP from generated migrations.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embeddingVector_hnsw_idx"
ON "KnowledgeChunk"
USING hnsw ("embeddingVector" vector_cosine_ops);
