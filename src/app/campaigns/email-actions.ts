"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendCampaignEmail(campaignId: string, campaignRecipientId: string) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const from = process.env.EMAIL_FROM || (gmailUser ? `Avataar Outreach <${gmailUser}>` : undefined);
  if (!gmailUser || !gmailAppPassword || !from) redirect(`/campaigns/${campaignId}?sendError=config`);

  const now = new Date();
  const assignment = await getDb().campaignRecipient.findFirst({ where: { id: campaignRecipientId, campaignId }, include: { recipient: true, campaign: true, links: { where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { createdAt: "desc" }, take: 1 } } });
  const link = assignment?.links[0];
  if (!assignment || !link) redirect(`/campaigns/${campaignId}?sendError=link`);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(baseUrl)) redirect(`/campaigns/${campaignId}?sendError=publicUrl`);
  const recipientUrl = `${baseUrl}/r/${link.token}`;
  const delivery = await getDb().emailDelivery.create({ data: { campaignRecipientId, recipientLinkId: link.id } });
  const greeting = assignment.recipient.firstName ? `Hello ${escapeHtml(assignment.recipient.firstName)},` : "Hello,";
  const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gmailUser, pass: gmailAppPassword.replace(/\s/g, "") } });
  try {
    const result = await transporter.sendMail({ from, to: assignment.recipient.email, subject: assignment.campaign.subject ?? assignment.campaign.name, text: `${assignment.campaign.message}\n\nOpen your private invitation: ${recipientUrl}`, html: `<p>${greeting}</p><p>${escapeHtml(assignment.campaign.message).replace(/\n/g, "<br />")}</p><p><a href="${recipientUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600">Open your private invitation</a></p><p style="font-size:12px;color:#64748b">This invitation is personal to you. Please do not forward this link.</p>` });
    await getDb().emailDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", providerMessageId: result.messageId, sentAt: new Date() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail SMTP delivery failed.";
    await getDb().emailDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", errorMessage: message } });
    redirect(`/campaigns/${campaignId}?sendError=provider`);
  }
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}?sent=1`);
}
