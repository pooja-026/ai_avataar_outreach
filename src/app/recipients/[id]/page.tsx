import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
import { updateRecipient } from "../actions";
import { RecipientForm } from "../recipient-form";

type Insights = {
  interestLevel: string;
  keyInterests: string[];
  questionsOrObjections: string[];
  recommendedNextAction: string;
  followUpTiming: string;
};

function parseInsights(value: unknown): Insights | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.interestLevel !== "string" || !Array.isArray(item.keyInterests) || !Array.isArray(item.questionsOrObjections) || typeof item.recommendedNextAction !== "string" || typeof item.followUpTiming !== "string") return null;
  return {
    interestLevel: item.interestLevel,
    keyInterests: item.keyInterests.filter((entry): entry is string => typeof entry === "string"),
    questionsOrObjections: item.questionsOrObjections.filter((entry): entry is string => typeof entry === "string"),
    recommendedNextAction: item.recommendedNextAction,
    followUpTiming: item.followUpTiming,
  };
}

export default async function RecipientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const recipient = await getDb().recipient.findUnique({
    where: { id },
    include: {
      campaigns: {
        include: {
          campaign: true,
          sessions: { orderBy: { createdAt: "desc" }, take: 1, include: { messages: { orderBy: { sequence: "asc" } } } },
        },
        orderBy: { lastConversationAt: "desc" },
      },
    },
  });
  if (!recipient) notFound();

  const latestCampaignConversation = recipient.campaigns.find((assignment) => assignment.conversationSummary);
  const latestSession = recipient.campaigns.flatMap((assignment) => assignment.sessions).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const insights = parseInsights(recipient.conversationInsights);
  const displayName = [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || recipient.email;

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-slate-500 hover:text-indigo-700" href="/recipients">← All recipients</Link>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Recipient</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{displayName}</h1>
          {(query.created === "1" || query.saved === "1") && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.created === "1" ? "Recipient created." : "Changes saved."}</p>}
          <div className="mt-8"><RecipientForm action={updateRecipient.bind(null, recipient.id)} recipient={recipient} error={query.error} submitLabel="Save changes" /></div>
        </section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Conversation intelligence</p>
          <h2 className="mt-3 text-2xl font-semibold">Latest recipient recap</h2>
          {recipient.conversationSummary ? <><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700">{recipient.conversationSummary}</p>{insights && <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Interest level</p><p className="mt-2 text-lg font-semibold capitalize text-indigo-950">{insights.interestLevel}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">Suggested timing</p><p className="mt-2 text-sm font-medium leading-6 text-emerald-950">{insights.followUpTiming}</p></div><div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Recommended next action</p><p className="mt-2 text-sm leading-6 text-slate-800">{insights.recommendedNextAction}</p></div>{insights.keyInterests.length > 0 && <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Key interests</p><ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">{insights.keyInterests.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{insights.questionsOrObjections.length > 0 && <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Questions or objections</p><ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">{insights.questionsOrObjections.map((item) => <li key={item}>• {item}</li>)}</ul></div>}</div>}{recipient.lastConversationAt && <p className="mt-5 text-xs text-slate-500">Updated {recipient.lastConversationAt.toLocaleString()}{latestCampaignConversation ? ` · ${latestCampaignConversation.campaign.name}` : ""}.</p>}</> : <p className="mt-4 text-sm leading-6 text-slate-500">No completed conversation has been recorded yet.</p>}
        </section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Latest transcript</p>
          <h2 className="mt-3 text-2xl font-semibold">What was said</h2>
          {latestSession?.messages.length ? <div className="mt-6 space-y-3">{latestSession.messages.map((message) => <div className={`rounded-xl p-4 text-sm leading-6 ${message.role === "USER" ? "bg-indigo-50 text-indigo-950" : "bg-slate-50 text-slate-700"}`} key={message.id}><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{message.role === "USER" ? "Recipient" : "Avatar"}</p>{message.content}</div>)}</div> : <p className="mt-4 text-sm leading-6 text-slate-500">The transcript will appear after the recipient has completed a conversation.</p>}
        </section>
      </div>
    </main>
  );
}
