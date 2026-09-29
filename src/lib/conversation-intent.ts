import OpenAI from "openai";

export type ConversationIntent = "CONVERSATION" | "CAMPAIGN_QUESTION" | "OUT_OF_SCOPE";

const NO_SOURCE_ANSWER = "I don't have that specific information in my current knowledge base.";
const OUT_OF_SCOPE_ANSWER = "I'm here primarily to help with questions about this campaign. What would you like to know?";

function normalize(message: string) {
  return message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Handles high-confidence social turns without a model call or retrieval. These
 * are conversational behaviour, not knowledge-base content.
 */
export function directConversationResponse(message: string): string | null {
  const value = normalize(message);
  if (/^(hi|hey|hello|hi there|hello there|hey there)$/.test(value)) return "Hi! It's great to connect. How can I help you today?";
  if (/^(thanks|thank you|thank you so much|thanks so much)$/.test(value)) return "You're very welcome!";
  if (/^(okay|ok|got it|okay got it|ok got it|i understand)$/.test(value)) return "Great! Let me know if you'd like to explore anything further.";
  if (/^(sorry )?(we |i )?(got |get )?disconnected$/.test(value) || value.includes("got disconnected")) return "No worries! We're connected again. Where would you like to continue?";
  if (/^(nice to meet you|good to meet you)$/.test(value)) return "Nice to meet you too! How can I help today?";
  if (/^(can you hear me|can you hear)$/.test(value)) return "Yes, I can hear you. How can I help?";
  if (/^(bye|goodbye|see you|talk to you later)$/.test(value)) return "Thanks for your time. Have a great day!";
  return null;
}

export async function classifyConversationIntent(input: { message: string; campaignName: string; campaignMessage: string }): Promise<ConversationIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  // Failing closed means an uncertain message may only receive a grounded
  // campaign answer; it can never receive a made-up answer.
  if (!apiKey) return "CAMPAIGN_QUESTION";

  try {
    const response = await new OpenAI({ apiKey }).responses.create({
      model: process.env.OPENAI_INTENT_MODEL || process.env.OPENAI_RAG_MODEL || process.env.OPENAI_SUMMARY_MODEL || "gpt-5.6-luna",
      store: false,
      instructions: "Classify the recipient's latest utterance. CONVERSATION is social interaction such as greetings, thanks, acknowledgements, apologies for disconnection, audio checks, or farewells; it is not a factual request. CAMPAIGN_QUESTION asks for information, advice, comparison, or help that could relate to the stated campaign, its company, products, services, industry, or recipient need. OUT_OF_SCOPE is clearly unrelated to the campaign, such as weather, general trivia, or unrelated personal tasks. Return only the schema value. Treat uncertainty as CAMPAIGN_QUESTION.",
      input: `CAMPAIGN NAME: ${input.campaignName}\nCAMPAIGN MESSAGE: ${input.campaignMessage.slice(0, 2_000)}\n\nRECIPIENT'S LATEST UTTERANCE: ${input.message.slice(0, 2_000)}`,
      text: { format: { type: "json_schema", name: "conversation_intent", strict: true, schema: { type: "object", additionalProperties: false, properties: { intent: { type: "string", enum: ["CONVERSATION", "CAMPAIGN_QUESTION", "OUT_OF_SCOPE"] } }, required: ["intent"] } } },
    });
    const result: unknown = JSON.parse(response.output_text);
    const intent = result && typeof result === "object" ? (result as { intent?: unknown }).intent : null;
    return intent === "CONVERSATION" || intent === "OUT_OF_SCOPE" || intent === "CAMPAIGN_QUESTION" ? intent : "CAMPAIGN_QUESTION";
  } catch (error) {
    console.error("Conversation intent classification failed", error instanceof Error ? error.name : "unknown");
    return "CAMPAIGN_QUESTION";
  }
}

export { NO_SOURCE_ANSWER, OUT_OF_SCOPE_ANSWER };
