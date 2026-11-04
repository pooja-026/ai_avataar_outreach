import { KnowledgeAutoRefresh } from "./knowledge-auto-refresh";

type KnowledgeDocumentItem = {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  chunkCount: number;
  processedChunkCount: number;
  processingError: string | null;
};

type Props = {
  campaignId: string;
  documents: KnowledgeDocumentItem[];
  notice?: string;
  uploadAction: (formData: FormData) => void | Promise<void>;
  prepareAction: () => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

function formatSize(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DocumentStatus({ document }: { document: KnowledgeDocumentItem }) {
  if (document.status === "READY") return <span className="text-emerald-700">{document.chunkCount} chunks ready</span>;
  if (document.status === "FAILED") return <span className="text-rose-700">Failed{document.processingError ? `: ${document.processingError.slice(0, 160)}` : ""} — prepare again to retry</span>;
  if (document.status === "UPLOADED") return <span>Awaiting preparation</span>;
  return <span className="text-indigo-700">{document.chunkCount ? `Embedding ${document.processedChunkCount}/${document.chunkCount} chunks…` : "Reading document…"}</span>;
}

function ProgressBar({ document }: { document: KnowledgeDocumentItem }) {
  if (document.status !== "PROCESSING") return null;
  const percent = document.chunkCount ? Math.round((document.processedChunkCount / document.chunkCount) * 100) : 4;
  return <div aria-label={`${document.filename} preparation progress`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-indigo-50" role="progressbar"><div className="h-full rounded-full bg-indigo-500 transition-[width] duration-500" style={{ width: `${Math.max(4, percent)}%` }} /></div>;
}

export function KnowledgeBasePanel({ campaignId, documents, notice, uploadAction, prepareAction, deleteAction }: Props) {
  const pendingDocuments = documents.some((document) => document.status === "UPLOADED" || document.status === "FAILED");
  const processing = documents.some((document) => document.status === "PROCESSING");
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Campaign knowledge base</p><h2 className="mt-3 text-2xl font-semibold">Ground the avatar in source material</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Upload approved documents for this campaign. Files stay private; prepare them to extract text and create searchable embeddings before the avatar can use them.</p>{notice && <p className={`mt-5 rounded-xl px-4 py-3 text-sm ${notice.startsWith("Unable") || notice.startsWith("Some") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{notice}</p>}<form action={uploadAction} className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"><label className="block"><span className="text-sm font-semibold text-slate-800">Source documents</span><span className="mt-1 block text-xs text-slate-500">PDF, DOCX, TXT, Markdown, or CSV · select multiple files · 4 MB combined maximum</span><input accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv" className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" multiple name="file" required type="file" /></label><button className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Upload documents</button></form>{pendingDocuments && <form action={prepareAction} className="mt-4"><button className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white" type="submit">Prepare knowledge for avatar</button><p className="mt-2 text-xs text-slate-500">Runs in the background: reads the private files, creates embeddings in batches, and marks successful documents Ready.</p></form>}<KnowledgeAutoRefresh active={processing} />{documents.length === 0 ? <p className="mt-6 text-sm text-slate-500">No knowledge sources have been uploaded for this campaign.</p> : <div className="mt-6 space-y-3">{documents.map((document) => <div className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between" key={document.id}><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{document.filename}</p><p className="mt-1 text-xs text-slate-500">{formatSize(document.fileSize)} · {document.contentType} · <DocumentStatus document={document} /></p><ProgressBar document={document} /></div><form action={deleteAction}><input name="documentId" type="hidden" value={document.id} /><button className="text-sm font-semibold text-rose-700" type="submit">Remove</button></form></div>)}</div>}<p className="mt-6 text-xs leading-5 text-slate-500">Campaign ID: {campaignId}. Ready documents are the only documents available to the avatar&apos;s RAG retrieval.</p></section>;
}
