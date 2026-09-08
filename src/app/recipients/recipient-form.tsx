import type { Recipient } from "../../../generated/prisma/client";

type Props = { action: (formData: FormData) => void | Promise<void>; recipient?: Recipient; error?: string; submitLabel: string };
const errors: Record<string, string> = { email: "Enter a valid email address.", length: "Keep names and context within the allowed length.", duplicate: "A recipient with this email already exists." };

export function RecipientForm({ action, recipient, error, submitLabel }: Props) {
  const notes = recipient?.context && typeof recipient.context === "object" && "notes" in recipient.context && typeof recipient.context.notes === "string" ? recipient.context.notes : "";
  return <form action={action} className="space-y-6">
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{errors[error] ?? "Unable to save this recipient."}</p>}
    <div className="grid gap-5 sm:grid-cols-2"><label><span className="text-sm font-semibold">First name</span><input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={recipient?.firstName ?? ""} maxLength={100} name="firstName" /></label><label><span className="text-sm font-semibold">Last name</span><input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={recipient?.lastName ?? ""} maxLength={100} name="lastName" /></label></div>
    <label className="block"><span className="text-sm font-semibold">Email address</span><input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={recipient?.email} name="email" placeholder="name@company.com" required type="email" /></label>
    <label className="block"><span className="text-sm font-semibold">Additional context <span className="font-normal text-slate-400">(optional)</span></span><p className="mt-1 text-sm text-slate-500">Private notes about this recipient. Campaign-specific context is added from a campaign.</p><textarea className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={notes} maxLength={2000} name="notes" /></label>
    <div className="flex justify-end border-t border-slate-100 pt-6"><button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white" type="submit">{submitLabel}</button></div>
  </form>;
}
