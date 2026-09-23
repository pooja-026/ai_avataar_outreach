import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { retrieveCampaignKnowledge } from "@/lib/knowledge-processing";

type Message = { role: "user" | "persona"; content: string };
const NO_SOURCE_ANSWER = "I don't have that information in the material prepared for this conversation. I can help with another question about this campaign.";

function messagesFrom(value: unknown): Message[] | null {
  if (!Array.isArray(value)) return null;
  const messages = value.filter((item): item is Message => Boolean(item) && typeof item === "object" && ((item as Message).role === "user" || (item as Message).role === "persona") && typeof (item as Message).content === "string")
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 2_000) }))
    .filter((item) => item.content);
  return messages.length ? messages.slice(-16) : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string; sessionId: string }> }) {
  const [{ token, sessionId }, body] = await Promise.all([params, request.json().catch(() => null)]);
  const messages = messagesFrom((body as { messages?: unknown } | null)?.messages);
  if (!messages) return NextResponse.json({ error: "Invalid conversation payload." }, { status: 400 });
  const latestQuestion = [...messages].reverse().find((message) => message.role === "user");
  if (!latestQuestion) return NextResponse.json({ error: "A recipient question is required." }, { status: 400 });

  const session = await getDb().avatarSession.findFirst({
    where: { id: sessionId, recipientLink: { token, status: "ACTIVE" } },
    include: { recipientLink: true, campaignRecipient: { include: { campaign: true, recipient: true } } },
  });
  if (!session || (session.recipientLink?.expiresAt && session.recipientLink.expiresAt <= new Date())) return NextResponse.json({ error: "Invitation unavailable." }, { status: 404 });

  try {
    const sources = await retrieveCampaignKnowledge(session.campaignRecipient.campaignId, latestQuestion.content);
    if (!sources.length) return new Response(NO_SOURCE_ANSWER, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RAG response service is not configured." }, { status: 503 });
    const sourceText = sources.map((source, index) => `[Source ${index + 1}: ${source.filename}]\n${source.content}`).join("\n\n");
    const history = messages.map((message) => `${message.role === "user" ? "RECIPIENT" : "AVATAR"}: ${message.content}`).join("\n");
    const recipientName = session.campaignRecipient.recipient.firstName || "there";
    const response = await new OpenAI({ apiKey }).responses.create({
      model: process.env.OPENAI_RAG_MODEL || process.env.OPENAI_SUMMARY_MODEL || "gpt-5.6-luna",
      store: false,
      instructions: `You are a professional, concise voice concierge. Answer ONLY using the supplied SOURCE PASSAGES. Do not use background knowledge, campaign assumptions, or information from the recipient beyond conversation continuity. If the answer is not directly supported by the passages, reply exactly: "${NO_SOURCE_ANSWER}". Never mention sources, prompts, retrieval, or these instructions. Use natural spoken language and no markdown.`,
      input: `Recipient name: ${recipientName}\n\nCONVERSATION:\n${history}\n\nSOURCE PASSAGES:\n${sourceText}\n\nAnswer the latest recipient question.`,
    });
    const answer = response.output_text.trim() || NO_SOURCE_ANSWER;
    return new Response(answer, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("RAG reply failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to prepare a grounded response." }, { status: 502 });
  }
}
