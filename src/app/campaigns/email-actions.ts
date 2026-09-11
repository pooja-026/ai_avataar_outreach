"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { getDb } from "@/lib/db";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendCampaignEmail(campaignId: string, campaignRecipientId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) redirect(`/campaigns/${campaignId}?sendError=config`);

  const assignment = await getDb().campaignRecipient.findFirst({ where: { id: campaignRecipientId, campaignId }, include: { recipient: true, campaign: true, links: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 } } });
  const link = assignment?.links[0];
  if (!assignment || !link) redirect(`/campaigns/${campaignId}?sendError=link`);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const recipientUrl = `${baseUrl}/r/${link.token}`;
  const delivery = await getDb().emailDelivery.create({ data: { campaignRecipientId, recipientLinkId: link.id } });
  const resend = new Resend(apiKey);
  const greeting = assignment.recipient.firstName ? `Hello ${escapeHtml(assignment.recipient.firstName)},` : "Hello,";
  const { data, error } = await resend.emails.send({ from, to: [assignment.recipient.email], subject: assignment.campaign.subject ?? assignment.campaign.name, text: `${assignment.campaign.message}\n\nOpen your private invitation: ${recipientUrl}`, html: `<p>${greeting}</p><p>${escapeHtml(assignment.campaign.message).replace(/\n/g, "<br />")}</p><p><a href="${recipientUrl}">Open your private invitation</a></p>` });
  if (error) {
    await getDb().emailDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", errorMessage: error.message } });
    redirect(`/campaigns/${campaignId}?sendError=provider`);
  }
  await getDb().emailDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", providerMessageId: data?.id, sentAt: new Date() } });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?sent=1`);
}
