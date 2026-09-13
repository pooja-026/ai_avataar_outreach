import Link from "next/link";
import { CampaignForm } from "../campaign-form";
import { createCampaign } from "../actions";

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-950 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-700" href="/campaigns">← All campaigns</Link>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold tracking-[0.14em] text-indigo-600 uppercase">Campaign draft</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create a thoughtful first touch.</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">Start with the message. Recipients, secure links, and delivery settings come next.</p>
          <div className="mt-9"><CampaignForm action={createCampaign} error={error} submitLabel="Save campaign draft" /></div>
        </section>
      </div>
    </main>
  );
}
