"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

function recipientValues(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "email" as const };
  if (firstName.length > 100 || lastName.length > 100 || notes.length > 2000) return { error: "length" as const };
  return { firstName: firstName || null, lastName: lastName || null, email, context: notes ? { notes } : undefined };
}

export async function createRecipient(formData: FormData) {
  await requireAdmin();
  const values = recipientValues(formData);
  if ("error" in values) redirect(`/recipients/new?error=${values.error}`);
  if (await getDb().recipient.findUnique({ where: { email: values.email } })) redirect("/recipients/new?error=duplicate");
  const recipient = await getDb().recipient.create({ data: values });
  revalidatePath("/recipients");
  redirect(`/recipients/${recipient.id}?created=1`);
}

export async function updateRecipient(id: string, formData: FormData) {
  await requireAdmin();
  const values = recipientValues(formData);
  if ("error" in values) redirect(`/recipients/${id}?error=${values.error}`);
  const existing = await getDb().recipient.findUnique({ where: { email: values.email } });
  if (existing && existing.id !== id) redirect(`/recipients/${id}?error=duplicate`);
  await getDb().recipient.update({ where: { id }, data: values });
  revalidatePath("/recipients");
  revalidatePath(`/recipients/${id}`);
  redirect(`/recipients/${id}?saved=1`);
}

export async function assignRecipient(campaignId: string, formData: FormData) {
  await requireAdmin();
  const recipientId = String(formData.get("recipientId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!recipientId) redirect(`/campaigns/${campaignId}?recipientError=missing`);
  await getDb().campaignRecipient.upsert({ where: { campaignId_recipientId: { campaignId, recipientId } }, create: { campaignId, recipientId, context: notes ? { notes } : undefined }, update: { context: notes ? { notes } : undefined } });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?recipientAdded=1`);
}

export async function removeRecipient(campaignId: string, campaignRecipientId: string) {
  await requireAdmin();
  // Scoped to the campaign so an ID from another campaign cannot be removed through this page.
  await getDb().campaignRecipient.deleteMany({ where: { id: campaignRecipientId, campaignId } });
  revalidatePath(`/campaigns/${campaignId}`);
}
