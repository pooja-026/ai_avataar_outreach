import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { updateRecipient } from "../actions";
import { RecipientForm } from "../recipient-form";

export default async function RecipientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const recipient = await getDb().recipient.findUnique({
    where: { id },
    include: { campaigns: { include: { campaign: true }, orderBy: { lastConversationAt: "desc" } } },
  });
  if (!recipient) notFound();

  const latestCampaignConversation = recipient.campaigns.find((assignment) => assignment.conversationSummary);
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
          {recipient.conversationSummary ? <><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{recipient.conversationSummary}</p>{recipient.lastConversationAt && <p className="mt-4 text-xs text-slate-500">Updated {recipient.lastConversationAt.toLocaleString()}.</p>}</> : <p className="mt-4 text-sm leading-6 text-slate-500">No completed conversation has been recorded yet.</p>}
          {latestCampaignConversation && <div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500 uppercase">Campaign context · {latestCampaignConversation.campaign.name}</p><p className="mt-2 text-sm leading-6 text-slate-700">{latestCampaignConversation.conversationSummary}</p></div>}
        </section>
      </div>
    </main>
  );
}
