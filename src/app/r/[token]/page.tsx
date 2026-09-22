import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { RecipientExperience } from "./recipient-experience";

function ExpiredInvitation() {
  return <main className="min-h-screen bg-[#07111f] px-5 py-8 text-white"><div className="mx-auto flex min-h-[80vh] max-w-xl items-center"><section className="w-full rounded-3xl border border-white/10 bg-white/[.045] p-8 text-center shadow-2xl shadow-black/30 sm:p-12"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-300/15 text-2xl text-amber-200">!</div><p className="mt-7 text-xs font-semibold tracking-[.16em] text-cyan-300 uppercase">Invitation expired</p><h1 className="mt-4 text-3xl font-semibold tracking-tight">This invitation is no longer available.</h1><p className="mt-5 text-base leading-7 text-slate-300">This link was valid only for 24 hours. Please contact the person who sent you this invitation to request a new link.</p></section></div></main>;
}

export default async function RecipientLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getDb().recipientLink.findUnique({ where: { token }, include: { campaignRecipient: { include: { recipient: true, campaign: true } } } });
  if (!link || link.status !== "ACTIVE") notFound();
  if (link.expiresAt && link.expiresAt <= new Date()) {
    await getDb().recipientLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
    return <ExpiredInvitation />;
  }
  const { recipient, campaign } = link.campaignRecipient;
  return <RecipientExperience campaignName={campaign.name} firstName={recipient.firstName} message={campaign.message} token={token} />;
}
