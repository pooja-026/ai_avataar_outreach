import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await getDb().campaign.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-950 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end"><div><Link className="text-sm font-semibold text-slate-500 transition hover:text-indigo-700" href="/">← Dashboard</Link><p className="mt-7 text-xs font-semibold tracking-[0.14em] text-indigo-600 uppercase">Campaigns</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Your outreach drafts</h1><p className="mt-2 text-slate-600">Create messages now. Recipients and delivery will follow.</p></div><Link className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800" href="/campaigns/new">+ New campaign</Link></header>
        {campaigns.length === 0 ? <section className="mt-8 grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-100 text-xl text-indigo-700">✦</div><h2 className="mt-5 text-xl font-semibold">Your first campaign starts here.</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Draft your message before inviting any recipients or starting a conversation.</p><Link className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/campaigns/new">Create campaign</Link></div></section> : <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase sm:grid-cols-[minmax(0,1fr)_140px_130px]"><span>Campaign</span><span className="hidden sm:block">Status</span><span>Updated</span></div>{campaigns.map((campaign) => <Link className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 px-5 py-5 transition last:border-0 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_140px_130px]" href={`/campaigns/${campaign.id}`} key={campaign.id}><div className="min-w-0"><p className="truncate font-semibold">{campaign.name}</p><p className="mt-1 truncate text-sm text-slate-500">{campaign.subject ?? "No email subject yet"}</p></div><span className="hidden w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:block">Draft</span><time className="text-xs text-slate-500" dateTime={campaign.updatedAt.toISOString()}>{campaign.updatedAt.toLocaleDateString()}</time></Link>)}</section>}
      </div>
    </main>
  );
}
