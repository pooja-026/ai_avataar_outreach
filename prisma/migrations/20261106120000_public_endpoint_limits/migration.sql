-- Usage counters for rate-limiting the public recipient endpoints.
ALTER TABLE "RecipientLink" ADD COLUMN "sessionCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AvatarSession" ADD COLUMN "replyCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReplyAt" TIMESTAMP(3);
