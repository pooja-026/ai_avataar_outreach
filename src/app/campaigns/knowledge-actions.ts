"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getDb } from "@/lib/db";
import { claimCampaignKnowledge, processKnowledgeDocuments } from "@/lib/knowledge-processing";

const MAX_BATCH_SIZE = 4 * 1024 * 1024;
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
  const files = formData.getAll("file");
  if (!files.length || files.some((file) => !(file instanceof File) || !file.name || file.size === 0 || !ACCEPTED_TYPES.has(file.type)) || files.reduce((total, file) => total + (file instanceof File ? file.size : 0), 0) > MAX_BATCH_SIZE) {
    redirect(`/campaigns/${campaignId}?knowledgeError=file`);
  }

  // @vercel/blob authenticates with either a read-write token or OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN, supplied on Vercel).
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) redirect(`/campaigns/${campaignId}?knowledgeError=blobConfig`);
  const campaign = await getDb().campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) redirect("/campaigns");

  try {
    for (const file of files) {
      if (!(file instanceof File)) continue;
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
    }
  } catch (error) {
    console.error("Knowledge document upload failed", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
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

export async function prepareCampaignKnowledge(campaignId: string) {
  if (!process.env.OPENAI_API_KEY) redirect(`/campaigns/${campaignId}?knowledgeError=processing`);
  let documentIds: string[];
  try {
    documentIds = await claimCampaignKnowledge(campaignId);
  } catch (error) {
    console.error("Campaign knowledge claim failed", error instanceof Error ? error.name : "unknown");
    redirect(`/campaigns/${campaignId}?knowledgeError=processing`);
  }

  // Runs after the redirect is sent, bounded by the campaign page's maxDuration.
  // The admin page polls for progress while documents are PROCESSING.
  if (documentIds.length) {
    after(async () => {
      const result = await processKnowledgeDocuments(documentIds);
      console.info("knowledge_processing_complete", { campaignId, ...result });
    });
  }
  refreshCampaign(campaignId);
  redirect(`/campaigns/${campaignId}?knowledge=${documentIds.length ? "processing" : "nothingToProcess"}`);
}
