import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildConversationRecap, type ConversationTurn } from "@/lib/conversation-recap";
import { createSemanticSummary } from "@/lib/semantic-summary";
import { planTranscriptWrite } from "@/lib/transcript";

// Well above a full conversation (LIMIT_REPLIES_PER_SESSION replies plus the recipient's turns).
const MAX_MESSAGES = 400;
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

  // Lock the session row so concurrent saves are applied one at a time, in order.
  const write = await db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<Array<{ status: string }>>`SELECT "status" FROM "AvatarSession" WHERE "id" = ${sessionId}::uuid FOR UPDATE`;
    if (!locked || locked.status === "ENDED") return { alreadyEnded: true as const };

    const [storedCount, storedLast] = await Promise.all([
      tx.conversationMessage.count({ where: { sessionId } }),
      tx.conversationMessage.findFirst({ where: { sessionId }, orderBy: { sequence: "desc" }, select: { sequence: true, role: true, content: true } }),
    ]);
    const plan = planTranscriptWrite(storedCount, storedLast, messages);
    if (plan.updateLast && storedLast) {
      await tx.conversationMessage.update({ where: { sessionId_sequence: { sessionId, sequence: storedLast.sequence } }, data: { content: plan.updateLast } });
    }
    if (plan.append.length) {
      await tx.conversationMessage.createMany({ data: plan.append.map((turn) => ({ sessionId, sequence: turn.sequence, role: turn.role, content: turn.content })) });
    }
    const now = new Date();
    await tx.avatarSession.update({
      where: { id: sessionId },
      data: {
        status: ended ? "ENDED" : "ACTIVE",
        startedAt: session.startedAt ?? now,
        ...(ended ? { endedAt: now } : {}),
        ...(providerSessionId ? { providerSessionId } : {}),
      },
    });
    return { alreadyEnded: false as const, appended: plan.append.length };
  });

  // Ending is claimed inside the lock above, so the summary runs once per session.
  if (write.alreadyEnded) return NextResponse.json({ saved: false, ended: true });
  if (!ended) return NextResponse.json({ saved: true, appended: write.appended });

  // Summarize the stored transcript, not the client-supplied payload.
  const transcript = (await db.conversationMessage.findMany({ where: { sessionId }, orderBy: { sequence: "asc" }, select: { role: true, content: true } }))
    .filter((turn): turn is ConversationTurn => turn.role === "USER" || turn.role === "ASSISTANT");
  const insights = await createSemanticSummary(transcript);
  const recap = insights?.executiveSummary ?? buildConversationRecap(transcript);
  if (recap) {
    const now = new Date();
    const data = { conversationSummary: recap, ...(insights ? { conversationInsights: insights } : {}), lastConversationAt: now };
    await db.$transaction([
      db.campaignRecipient.update({ where: { id: session.campaignRecipientId }, data }),
      db.recipient.update({ where: { id: session.campaignRecipient.recipientId }, data }),
    ]);
  }

  return NextResponse.json({ saved: true, recap });
}
