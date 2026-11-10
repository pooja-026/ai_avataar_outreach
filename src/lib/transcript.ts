import type { ConversationTurn } from "@/lib/conversation-recap";

export type StoredTurn = ConversationTurn & { sequence: number };

/**
 * Decides how to merge the browser's full message history into the stored
 * transcript without ever rewriting history:
 * - messages already stored are immutable, except the LAST one, which may still
 *   be growing (the avatar's reply streams in, speech transcription is refined);
 * - messages beyond the stored count are appended with the next sequences;
 * - an older, shorter snapshot that arrives late changes nothing.
 */
export function planTranscriptWrite(storedCount: number, storedLast: { sequence: number; role: string; content: string } | null, incoming: ConversationTurn[]) {
  const append: StoredTurn[] = incoming.slice(storedCount).map((turn, index) => ({ ...turn, sequence: storedCount + index + 1 }));

  let updateLast: string | null = null;
  const candidate = storedCount > 0 ? incoming[storedCount - 1] : undefined;
  if (storedLast && candidate && candidate.role === storedLast.role && candidate.content !== storedLast.content
    // A strict prefix of what is stored is a stale snapshot of a streaming message.
    && !storedLast.content.startsWith(candidate.content)) {
    updateLast = candidate.content;
  }
  return { append, updateLast };
}
