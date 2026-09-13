export type ConversationTurn = {
  role: "USER" | "ASSISTANT";
  content: string;
};

function compact(value: string, limit = 300) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
}

function engagementSignal(recipientText: string) {
  const text = recipientText.toLowerCase();
  if (/\b(not interested|no thanks|unsubscribe|stop|don't contact)\b/.test(text)) {
    return { label: "Not interested", reason: "The recipient declined or asked not to continue.", nextStep: "Do not send another outreach message unless the recipient contacts you again." };
  }
  if (/\b(schedule|book|viewing|view|tour|visit|appointment|available)\b/.test(text)) {
    return { label: "High intent", reason: "The recipient mentioned arranging a viewing, visit, or time.", nextStep: "Offer two specific times for a viewing or a short follow-up call." };
  }
  if (/\b(price|cost|payment|when|where|how|what|details|question)\b/.test(text)) {
    return { label: "Needs information", reason: "The recipient asked for more detail.", nextStep: "Reply with the requested details, then invite them to take the next step." };
  }
  if (/\b(interested|sounds good|great|yes|like to|tell me more)\b/.test(text)) {
    return { label: "Interested", reason: "The recipient expressed positive interest.", nextStep: "Send a short tailored follow-up and invite a reply or viewing." };
  }
  return { label: "No clear intent", reason: "The conversation does not yet show a clear buying or follow-up signal.", nextStep: "Send a light follow-up only if it adds useful campaign information." };
}

export function buildConversationRecap(turns: ConversationTurn[]) {
  const meaningful = turns.filter((turn) => turn.content.trim());
  if (!meaningful.length) return null;

  const recipientTurns = meaningful.filter((turn) => turn.role === "USER");
  const avatarTurns = meaningful.filter((turn) => turn.role === "ASSISTANT");
  const latestRecipient = recipientTurns.at(-1);
  const latestAvatar = avatarTurns.at(-1);
  const signal = engagementSignal(recipientTurns.map((turn) => turn.content).join(" "));
  const parts = [
    `Engagement signal: ${signal.label}. ${signal.reason}`,
    `Conversation: ${recipientTurns.length} recipient message${recipientTurns.length === 1 ? "" : "s"} and ${avatarTurns.length} avatar response${avatarTurns.length === 1 ? "" : "s"}.`,
  ];

  if (latestRecipient) parts.push(`Latest recipient message: “${compact(latestRecipient.content)}”`);
  if (latestAvatar) parts.push(`Latest avatar response: “${compact(latestAvatar.content)}”`);
  parts.push(`Recommended next step: ${signal.nextStep}`);
  return parts.join(" ");
}
