import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildConversationRecap, type ConversationTurn } from "@/lib/conversation-recap";

const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 4_000;

type IncomingMessage = { role?: unknown; content?: unknown };

function normalizeMessages(value: unknown): ConversationTurn[] | null {
  if (!Array.isArray(value) || value.length > MAX_MESSAGES) return null;

  const turns: ConversationTurn[] = [];
  for (const item of value as IncomingMessage[]) {
    if (typeof item.content !== "string") return null;
    const content = item.content.trim();
    if (!content || content.length > MAX_CONTENT_LENGTH) return null;
    if (item.role === "user") turns.push({ role: "USER", content });
    else if (item.role === "persona") turns.push({ role: "ASSISTANT", content });
    else return null;
  }
  return turns;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string; sessionId: string }> }) {
  const [{ token, sessionId }, payload] = await Promise.all([params, request.json().catch(() => null)]);
  const messages = normalizeMessages(payload && typeof payload === "object" && "messages" in payload ? payload.messages : null);
  const ended = Boolean(payload && typeof payload === "object" && "ended" in payload && payload.ended);
  const providerSessionId = payload && typeof payload === "object" && "providerSessionId" in payload && typeof payload.providerSessionId === "string"
    ? payload.providerSessionId.slice(0, 200)
    : null;

  if (!messages) return NextResponse.json({ error: "Invalid conversation payload." }, { status: 400 });

  const db = getDb();
  const session = await db.avatarSession.findFirst({
    where: { id: sessionId, recipientLink: { token, status: "ACTIVE" } },
    include: { campaignRecipient: true },
  });
  if (!session) return NextResponse.json({ error: "Conversation session unavailable." }, { status: 404 });

  const recap = buildConversationRecap(messages);
  const now = new Date();
  await db.$transaction([
    db.conversationMessage.deleteMany({ where: { sessionId } }),
    ...(messages.length
      ? [db.conversationMessage.createMany({
          data: messages.map((message, index) => ({ sessionId, sequence: index + 1, role: message.role, content: message.content })),
        })]
      : []),
    db.avatarSession.update({
      where: { id: sessionId },
      data: {
        status: ended ? "ENDED" : "ACTIVE",
        startedAt: session.startedAt ?? now,
        ...(ended ? { endedAt: now } : {}),
        ...(providerSessionId ? { providerSessionId } : {}),
      },
    }),
    ...(recap
      ? [
          db.campaignRecipient.update({ where: { id: session.campaignRecipientId }, data: { conversationSummary: recap, lastConversationAt: now } }),
          db.recipient.update({ where: { id: session.campaignRecipient.recipientId }, data: { conversationSummary: recap, lastConversationAt: now } }),
        ]
      : []),
  ]);

  return NextResponse.json({ saved: true, recap });
}
