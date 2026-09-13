"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

function campaignValues(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || name.length > 120) return { error: "name" as const };
  if (!message || message.length > 10000) return { error: "message" as const };
  if (subject.length > 250) return { error: "subject" as const };

  return { name, subject: subject || null, message };
}

export async function createCampaign(formData: FormData) {
  const values = campaignValues(formData);
  if ("error" in values) redirect(`/campaigns/new?error=${values.error}`);

  const campaign = await getDb().campaign.create({ data: values });
  revalidatePath("/");
  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}?created=1`);
}

export async function updateCampaign(id: string, formData: FormData) {
  const values = campaignValues(formData);
  if ("error" in values) redirect(`/campaigns/${id}?error=${values.error}`);

  await getDb().campaign.update({ where: { id }, data: values });
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  redirect(`/campaigns/${id}?saved=1`);
}
