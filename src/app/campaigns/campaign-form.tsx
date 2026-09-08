import type { Campaign } from "../../../generated/prisma/client";

type CampaignFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  campaign?: Campaign;
  error?: string;
  submitLabel: string;
};

const errorMessages: Record<string, string> = {
  name: "Enter a campaign name of 120 characters or fewer.",
  subject: "Keep the email subject to 250 characters or fewer.",
  message: "Enter a message of 10,000 characters or fewer.",
};

export function CampaignForm({ action, campaign, error, submitLabel }: CampaignFormProps) {
  return (
    <form action={action} className="space-y-6">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{errorMessages[error] ?? "Unable to save this campaign. Please review the form and try again."}</p>}
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Campaign name</span>
        <span className="mt-1 block text-sm text-slate-500">For your internal workspace only.</span>
        <input className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={campaign?.name} maxLength={120} name="name" placeholder="e.g. September executive outreach" required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Email subject <span className="font-normal text-slate-400">(optional)</span></span>
        <input className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={campaign?.subject ?? ""} maxLength={250} name="subject" placeholder="A quick conversation with our team" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Campaign message</span>
        <span className="mt-1 block text-sm text-slate-500">This draft will become the foundation for recipient outreach.</span>
        <textarea className="mt-3 min-h-56 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" defaultValue={campaign?.message} maxLength={10000} name="message" placeholder="Write the message you want recipients to receive…" required />
      </label>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">Saved as a draft. Sending and recipients are configured in later phases.</p>
        <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
