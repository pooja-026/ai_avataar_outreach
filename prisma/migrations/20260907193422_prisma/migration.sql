-- AlterTable
ALTER TABLE "AvatarConfiguration" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AvatarSession" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CampaignRecipient" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConversationMessage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Recipient" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecipientLink" ALTER COLUMN "id" DROP DEFAULT;
