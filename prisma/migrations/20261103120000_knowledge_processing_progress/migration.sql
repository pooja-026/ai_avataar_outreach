-- Track background knowledge preparation so the admin UI can show progress and
-- reclaim documents whose worker stopped before finishing.
ALTER TABLE "KnowledgeDocument"
ADD COLUMN "processedChunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processingStartedAt" TIMESTAMP(3);
