"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

function refreshCampaign(campaignId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function uploadKnowledgeDocument(campaignId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name || file.size === 0 || file.size > MAX_FILE_SIZE || !ACCEPTED_TYPES.has(file.type)) {
    redirect(`/campaigns/${campaignId}?knowledgeError=file`);
  }

  const campaign = await getDb().campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) redirect("/campaigns");

  try {
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "source-document";
    const blob = await put(`campaigns/${campaignId}/knowledge/${safeFilename}`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    });
    const document = await getDb().knowledgeDocument.create({
      data: { filename: file.name.slice(0, 255), contentType: file.type, fileSize: file.size, blobUrl: blob.url },
    });
    await getDb().campaignKnowledge.create({ data: { campaignId, documentId: document.id } });
  } catch (error) {
    console.error("Knowledge document upload failed", error instanceof Error ? error.name : "unknown");
    redirect(`/campaigns/${campaignId}?knowledgeError=storage`);
  }

  refreshCampaign(campaignId);
  redirect(`/campaigns/${campaignId}?knowledge=uploaded`);
}

export async function deleteKnowledgeDocument(campaignId: string, formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) redirect(`/campaigns/${campaignId}`);
  const assignment = await getDb().campaignKnowledge.findFirst({ where: { campaignId, documentId }, include: { document: true } });
  if (!assignment) redirect(`/campaigns/${campaignId}`);

  try {
    await del(assignment.document.blobUrl);
  } catch (error) {
    console.error("Knowledge document Blob deletion failed", error instanceof Error ? error.name : "unknown");
  }
  await getDb().knowledgeDocument.delete({ where: { id: documentId } });
  refreshCampaign(campaignId);
  redirect(`/campaigns/${campaignId}?knowledge=deleted`);
}
