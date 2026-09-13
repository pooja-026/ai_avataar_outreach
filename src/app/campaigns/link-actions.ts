"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

export async function createRecipientLink(campaignId: string, campaignRecipientId: string) {
  const db = getDb();
  const assignment = await db.campaignRecipient.findFirst({ where: { id: campaignRecipientId, campaignId } });
  if (!assignment) redirect(`/campaigns/${campaignId}`);

  await db.$transaction(async (tx) => {
    await tx.recipientLink.updateMany({ where: { campaignRecipientId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
    await tx.recipientLink.create({ data: { campaignRecipientId, token: randomBytes(32).toString("base64url") } });
  });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?linkCreated=1`);
}

export async function revokeRecipientLink(campaignId: string, linkId: string) {
  const link = await getDb().recipientLink.findFirst({ where: { id: linkId, campaignRecipient: { campaignId } } });
  if (!link) redirect(`/campaigns/${campaignId}`);
  await getDb().recipientLink.update({ where: { id: linkId }, data: { status: "REVOKED", revokedAt: new Date() } });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?linkRevoked=1`);
}
