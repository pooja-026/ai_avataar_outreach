type KnowledgeDocumentItem = {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  chunkCount: number;
};

type Props = {
  campaignId: string;
  documents: KnowledgeDocumentItem[];
  notice?: string;
  uploadAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

function formatSize(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function KnowledgeBasePanel({ campaignId, documents, notice, uploadAction, deleteAction }: Props) {
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><p className="text-xs font-semibold tracking-[.14em] text-indigo-600 uppercase">Campaign knowledge base</p><h2 className="mt-3 text-2xl font-semibold">Ground the avatar in source material</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Upload approved documents for this campaign. Files stay private; they will be processed into searchable knowledge before the avatar uses them.</p>{notice && <p className={`mt-5 rounded-xl px-4 py-3 text-sm ${notice.startsWith("Unable") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{notice}</p>}<form action={uploadAction} className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"><label className="block"><span className="text-sm font-semibold text-slate-800">Source documents</span><span className="mt-1 block text-xs text-slate-500">PDF, DOCX, TXT, Markdown, or CSV · select multiple files · 4 MB combined maximum</span><input accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv" className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" multiple name="file" required type="file" /></label><button className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Upload documents</button></form>{documents.length === 0 ? <p className="mt-6 text-sm text-slate-500">No knowledge sources have been uploaded for this campaign.</p> : <div className="mt-6 space-y-3">{documents.map((document) => <div className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between" key={document.id}><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{document.filename}</p><p className="mt-1 text-xs text-slate-500">{formatSize(document.fileSize)} · {document.contentType} · {document.status === "READY" ? `${document.chunkCount} chunks ready` : "Awaiting processing"}</p></div><form action={deleteAction}><input name="documentId" type="hidden" value={document.id} /><button className="text-sm font-semibold text-rose-700" type="submit">Remove</button></form></div>)}</div>}<p className="mt-6 text-xs leading-5 text-slate-500">Campaign ID: {campaignId}. The next phase extracts text, creates embeddings, and makes these sources retrievable during avatar conversations.</p></section>;
}
