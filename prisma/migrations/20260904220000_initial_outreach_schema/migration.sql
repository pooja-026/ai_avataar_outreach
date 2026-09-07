-- Phase 1: foundational outreach and isolated-conversation data model.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'ARCHIVED');
CREATE TYPE "RecipientLinkStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "AvatarSessionStatus" AS ENUM ('CREATED', 'CONNECTING', 'ACTIVE', 'ENDED', 'FAILED');
CREATE TYPE "ConversationRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');

CREATE TABLE "AvatarConfiguration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'anam',
  "providerKey" TEXT,
  "settings" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvatarConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "defaultContext" JSONB,
  "avatarConfigurationId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recipient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT NOT NULL,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignRecipient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipientLink" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignRecipientId" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "status" "RecipientLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "lastOpenedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecipientLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvatarSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignRecipientId" UUID NOT NULL,
  "recipientLinkId" UUID,
  "avatarConfigurationId" UUID,
  "providerSessionId" TEXT,
  "status" "AvatarSessionStatus" NOT NULL DEFAULT 'CREATED',
  "contextSnapshot" JSONB,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvatarSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "role" "ConversationRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Recipient_email_key" ON "Recipient"("email");
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_recipientId_key" ON "CampaignRecipient"("campaignId", "recipientId");
CREATE UNIQUE INDEX "RecipientLink_token_key" ON "RecipientLink"("token");
CREATE UNIQUE INDEX "AvatarSession_providerSessionId_key" ON "AvatarSession"("providerSessionId");
CREATE UNIQUE INDEX "ConversationMessage_sessionId_sequence_key" ON "ConversationMessage"("sessionId", "sequence");
CREATE INDEX "AvatarConfiguration_isActive_idx" ON "AvatarConfiguration"("isActive");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_avatarConfigurationId_idx" ON "Campaign"("avatarConfigurationId");
CREATE INDEX "CampaignRecipient_recipientId_idx" ON "CampaignRecipient"("recipientId");
CREATE INDEX "RecipientLink_campaignRecipientId_idx" ON "RecipientLink"("campaignRecipientId");
CREATE INDEX "RecipientLink_status_expiresAt_idx" ON "RecipientLink"("status", "expiresAt");
CREATE INDEX "AvatarSession_campaignRecipientId_createdAt_idx" ON "AvatarSession"("campaignRecipientId", "createdAt");
CREATE INDEX "AvatarSession_recipientLinkId_idx" ON "AvatarSession"("recipientLinkId");
CREATE INDEX "AvatarSession_status_idx" ON "AvatarSession"("status");
CREATE INDEX "ConversationMessage_sessionId_createdAt_idx" ON "ConversationMessage"("sessionId", "createdAt");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_avatarConfigurationId_fkey"
  FOREIGN KEY ("avatarConfigurationId") REFERENCES "AvatarConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipientLink" ADD CONSTRAINT "RecipientLink_campaignRecipientId_fkey"
  FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvatarSession" ADD CONSTRAINT "AvatarSession_campaignRecipientId_fkey"
  FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvatarSession" ADD CONSTRAINT "AvatarSession_recipientLinkId_fkey"
  FOREIGN KEY ("recipientLinkId") REFERENCES "RecipientLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AvatarSession" ADD CONSTRAINT "AvatarSession_avatarConfigurationId_fkey"
  FOREIGN KEY ("avatarConfigurationId") REFERENCES "AvatarConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AvatarSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
