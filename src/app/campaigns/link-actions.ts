"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function createRecipientLink(campaignId: string, campaignRecipientId: string) {
  await requireAdmin();
  const db = getDb();
  const assignment = await db.campaignRecipient.findFirst({ where: { id: campaignRecipientId, campaignId } });
  if (!assignment) redirect(`/campaigns/${campaignId}`);

  await db.$transaction(async (tx) => {
    await tx.recipientLink.updateMany({ where: { campaignRecipientId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
    await tx.recipientLink.create({
      data: {
        campaignRecipientId,
        token: randomBytes(32).toString("base64url"),
        expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
      },
    });
  });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?linkCreated=1`);
}

export async function revokeRecipientLink(campaignId: string, linkId: string) {
  await requireAdmin();
  const link = await getDb().recipientLink.findFirst({ where: { id: linkId, campaignRecipient: { campaignId } } });
  if (!link) redirect(`/campaigns/${campaignId}`);
  await getDb().recipientLink.update({ where: { id: linkId }, data: { status: "REVOKED", revokedAt: new Date() } });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?linkRevoked=1`);
}
