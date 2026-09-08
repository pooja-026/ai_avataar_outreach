import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export default async function RecipientLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getDb().recipientLink.findUnique({ where: { token }, include: { campaignRecipient: { include: { recipient: true, campaign: true } } } });
  if (!link || link.status !== "ACTIVE" || (link.expiresAt && link.expiresAt <= new Date())) notFound();
  const { recipient, campaign } = link.campaignRecipient;
  const greeting = recipient.firstName ? `Hello, ${recipient.firstName}` : "Hello";
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-12 text-white"><section className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/[.06] p-8 shadow-2xl sm:p-12"><p className="text-xs font-semibold tracking-[.16em] text-cyan-300 uppercase">A personal invitation</p><h1 className="mt-5 text-4xl font-semibold tracking-tight">{greeting}.</h1><p className="mt-5 text-lg leading-8 text-slate-200">You have been invited to connect regarding <span className="font-semibold text-white">{campaign.name}</span>.</p><div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{campaign.message}</p></div><p className="mt-8 text-sm leading-6 text-slate-400">A private avatar conversation will be available here soon. This invitation is unique to you.</p></section></main>;
}
