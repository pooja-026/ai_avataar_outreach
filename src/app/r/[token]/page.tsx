import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { RecipientExperience } from "./recipient-experience";

export default async function RecipientLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getDb().recipientLink.findUnique({ where: { token }, include: { campaignRecipient: { include: { recipient: true, campaign: true } } } });
  if (!link || link.status !== "ACTIVE" || (link.expiresAt && link.expiresAt <= new Date())) notFound();
  const { recipient, campaign } = link.campaignRecipient;
  return <RecipientExperience campaignName={campaign.name} firstName={recipient.firstName} message={campaign.message} token={token} />;
}
