-- Store embeddings in pgvector so retrieval remains fast as knowledge grows.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
ADD COLUMN "embeddingVector" vector(1536);

-- Preserve existing prepared documents. JSON embeddings are kept temporarily for
-- backwards compatibility, while this vector column becomes the query path.
UPDATE "KnowledgeChunk"
SET "embeddingVector" = ("embedding"::text)::vector
WHERE "embedding" IS NOT NULL;

-- HNSW is an approximate-nearest-neighbour index designed for low-latency
-- cosine similarity search at large document/chunk counts.
CREATE INDEX "KnowledgeChunk_embeddingVector_hnsw_idx"
ON "KnowledgeChunk"
USING hnsw ("embeddingVector" vector_cosine_ops);
