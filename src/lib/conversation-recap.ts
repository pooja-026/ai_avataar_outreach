export type ConversationTurn = {
  role: "USER" | "ASSISTANT";
  content: string;
};

function compact(value: string, limit = 300) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
}

export function buildConversationRecap(turns: ConversationTurn[]) {
  const meaningful = turns.filter((turn) => turn.content.trim());
  if (!meaningful.length) return null;

  const recipientTurns = meaningful.filter((turn) => turn.role === "USER");
  const avatarTurns = meaningful.filter((turn) => turn.role === "ASSISTANT");
  const latestRecipient = recipientTurns.at(-1);
  const latestAvatar = avatarTurns.at(-1);
  const parts = [`${recipientTurns.length} recipient message${recipientTurns.length === 1 ? "" : "s"} recorded.`];

  if (latestRecipient) parts.push(`Latest recipient message: “${compact(latestRecipient.content)}”`);
  if (latestAvatar) parts.push(`Latest avatar response: “${compact(latestAvatar.content)}”`);
  return parts.join(" ");
}
