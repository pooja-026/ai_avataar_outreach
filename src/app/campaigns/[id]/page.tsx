import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { assignRecipient } from "../../recipients/actions";
import { CampaignForm } from "../campaign-form";
import { createRecipientLink, revokeRecipientLink } from "../link-actions";
import { updateCampaign } from "../actions";
import { sendCampaignEmail } from "../email-actions";
import { KnowledgeBasePanel } from "../knowledge-base-panel";
import { deleteKnowledgeDocument, prepareCampaignKnowledge, uploadKnowledgeDocument } from "../knowledge-actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  created?: string; saved?: string; error?: string; recipientAdded?: string; linkCreated?: string; linkRevoked?: string;
  sent?: string; sendError?: string; knowledge?: string; knowledgeError?: string;
};

export default async function CampaignDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const db = getDb();
  const now = new Date();
  const [campaign, recipients, assignments, knowledge] = await Promise.all([
    db.campaign.findUnique({ where: { id } }),
    db.recipient.findMany({ orderBy: { email: "asc" } }),
    db.campaignRecipient.findMany({
      where: { campaignId: id },
      include: { recipient: true, links: { where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.campaignKnowledge.findMany({ where: { campaignId: id }, include: { document: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!campaign) notFound();

  const knowledgeNotice = query.knowledge === "uploaded" ? "Documents uploaded privately. Prepare them before the avatar can use them."
    : query.knowledge === "processed" ? "Knowledge is ready. The avatar can now retrieve these campaign sources."
    : query.knowledge === "partiallyProcessed" ? "Some documents could not be prepared. Review the failed documents and try again."
    : query.knowledge === "deleted" ? "Document removed."
      : query.knowledgeError === "file" ? "Unable to upload those files. Use supported file types with a 4 MB combined maximum."
        : query.knowledgeError === "storage" ? "Unable to store the document. Check the private Blob configuration and try again."
          : query.knowledgeError === "processing" ? "Unable to prepare the knowledge documents. Check the OpenAI key and document content, then try again."
          : undefined;

  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-950 sm:px-8"><div className="mx-auto max-w-3xl">
    <Link className="text-sm font-semibold text-slate-600 hover:text-indigo-700" href="/campaigns">← All campaigns</Link>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="flex justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Campaign draft</p><h1 className="mt-3 text-3xl font-semibold">{campaign.name}</h1></div><span className="h-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Draft</span></div>
      {(query.created === "1" || query.saved === "1") && <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Saved.</p>}
      <div className="mt-8"><CampaignForm action={updateCampaign.bind(null, campaign.id)} campaign={campaign} error={query.error} submitLabel="Save changes" /></div>
    </section>
    <KnowledgeBasePanel campaignId={campaign.id} deleteAction={deleteKnowledgeDocument.bind(null, campaign.id)} documents={knowledge.map(({ document }) => ({ id: document.id, filename: document.filename, contentType: document.contentType, fileSize: document.fileSize, status: document.status, chunkCount: document.chunkCount }))} notice={knowledgeNotice} prepareAction={prepareCampaignKnowledge.bind(null, campaign.id)} uploadAction={uploadKnowledgeDocument.bind(null, campaign.id)} />
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Recipients</p><h2 className="mt-3 text-2xl font-semibold">Assign people and issue links</h2>
      {query.sent === "1" && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Email sent.</p>}
      {query.sendError && <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Email could not be sent. Check Gmail configuration and public app URL.</p>}
      <form action={assignRecipient.bind(null, campaign.id)} className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4"><select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" defaultValue="" name="recipientId"><option disabled value="">Select a recipient</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.email}</option>)}</select><button className="w-fit rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Assign recipient</button></form>
      <div className="mt-6 space-y-3">{assignments.map((assignment) => { const link = assignment.links[0]; return <div className="rounded-xl border border-slate-100 p-4" key={assignment.id}><p className="font-semibold">{assignment.recipient.email}</p>{link ? <div className="mt-4 flex gap-3"><a className="text-xs font-semibold text-indigo-700" href={`/r/${link.token}`} target="_blank">Open link</a><form action={sendCampaignEmail.bind(null, campaign.id, assignment.id)}><button className="text-xs font-semibold text-emerald-700" type="submit">Send email</button></form><form action={revokeRecipientLink.bind(null, campaign.id, link.id)}><button className="text-xs font-semibold text-rose-700" type="submit">Revoke</button></form></div> : <form action={createRecipientLink.bind(null, campaign.id, assignment.id)} className="mt-4"><button className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700" type="submit">Generate secure link</button></form>}</div>; })}</div>
    </section>
  </div></main>;
}
