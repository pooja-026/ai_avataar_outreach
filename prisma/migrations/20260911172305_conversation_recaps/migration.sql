-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN     "conversationSummary" TEXT,
ADD COLUMN     "lastConversationAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "conversationSummary" TEXT,
ADD COLUMN     "lastConversationAt" TIMESTAMP(3);
