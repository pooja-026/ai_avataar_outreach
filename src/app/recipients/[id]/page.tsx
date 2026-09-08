import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { updateRecipient } from "../actions";
import { RecipientForm } from "../recipient-form";

export default async function RecipientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const recipient = await getDb().recipient.findUnique({ where: { id } });
  if (!recipient) notFound();
  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-3xl"><Link className="text-sm font-semibold text-slate-500 hover:text-indigo-700" href="/recipients">← All recipients</Link><section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><p className="text-xs font-semibold tracking-[0.14em] text-indigo-600 uppercase">Recipient</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{[recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || recipient.email}</h1>{(query.created === "1" || query.saved === "1") && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.created === "1" ? "Recipient created." : "Changes saved."}</p>}<div className="mt-8"><RecipientForm action={updateRecipient.bind(null, recipient.id)} recipient={recipient} error={query.error} submitLabel="Save changes" /></div></section></div></main>;
}
