-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN "conversationInsights" JSONB;

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN "conversationInsights" JSONB;
