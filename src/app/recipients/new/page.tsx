import Link from "next/link";
import { createRecipient } from "../actions";
import { RecipientForm } from "../recipient-form";

export default async function NewRecipientPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-3xl"><Link className="text-sm font-semibold text-slate-500 hover:text-indigo-700" href="/recipients">← All recipients</Link><section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><p className="text-xs font-semibold tracking-[0.14em] text-indigo-600 uppercase">Recipient</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Add a recipient</h1><p className="mt-3 text-slate-600">Store contact information now; assign this person to a campaign when ready.</p><div className="mt-8"><RecipientForm action={createRecipient} error={error} submitLabel="Save recipient" /></div></section></div></main>;
}
