import { getDb } from "@/lib/db";

/**
 * Usage limits for the public recipient endpoints, which spend money on every
 * call (Anam streaming, OpenAI embeddings and generation). Each limit is an
 * atomic conditional UPDATE, so concurrent requests cannot slip past it.
 */

function setting(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function usageLimits() {
  return {
    sessionsPerLink: setting("LIMIT_SESSIONS_PER_LINK", 5),
    repliesPerSession: setting("LIMIT_REPLIES_PER_SESSION", 60),
    sessionMinutes: setting("LIMIT_SESSION_MINUTES", 30),
    replyIntervalMs: setting("LIMIT_REPLY_INTERVAL_MS", 1_000),
  };
}

export const SESSION_LIMIT_MESSAGE = "This invitation has been used for the maximum number of conversations. Please reply to the invitation email if you'd like to talk further.";
export const REPLY_LIMIT_MESSAGE = "We've reached the end of the time available for this conversation. Thank you for chatting with me. Please reply to the invitation email if you'd like to continue.";

/** Reserves one avatar session for this link. Returns false when the link's allowance is used up. */
export async function claimAvatarSessionSlot(recipientLinkId: string) {
  const { count } = await getDb().recipientLink.updateMany({
    where: { id: recipientLinkId, sessionCount: { lt: usageLimits().sessionsPerLink } },
    data: { sessionCount: { increment: 1 } },
  });
  return count === 1;
}

/** Gives a reserved session back when the avatar provider failed, so failures do not use up the allowance. */
export async function releaseAvatarSessionSlot(recipientLinkId: string) {
  await getDb().recipientLink.updateMany({
    where: { id: recipientLinkId, sessionCount: { gt: 0 } },
    data: { sessionCount: { decrement: 1 } },
  });
}

export type ReplyClaim = "ok" | "burst" | "exhausted";

/**
 * Reserves one RAG reply in a session.
 * - "exhausted": the session is too old or has used all its replies (the avatar says goodbye).
 * - "burst": a reply started less than replyIntervalMs ago (likely a script; the request is dropped).
 */
export async function claimReplySlot(session: { id: string; createdAt: Date }, now = new Date()): Promise<ReplyClaim> {
  const limits = usageLimits();
  if (now.getTime() - session.createdAt.getTime() > limits.sessionMinutes * 60_000) return "exhausted";

  const db = getDb();
  const { count } = await db.avatarSession.updateMany({
    where: {
      id: session.id,
      replyCount: { lt: limits.repliesPerSession },
      OR: [{ lastReplyAt: null }, { lastReplyAt: { lte: new Date(now.getTime() - limits.replyIntervalMs) } }],
    },
    data: { replyCount: { increment: 1 }, lastReplyAt: now },
  });
  if (count === 1) return "ok";

  const current = await db.avatarSession.findUnique({ where: { id: session.id }, select: { replyCount: true } });
  return !current || current.replyCount >= limits.repliesPerSession ? "exhausted" : "burst";
}
