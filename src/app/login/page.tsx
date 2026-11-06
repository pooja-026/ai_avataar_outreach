import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { isAdminEmail, safeCallbackPath } from "@/lib/admin-access";

export const metadata: Metadata = { title: "Sign in · Avataar Outreach" };

const errorMessages: Record<string, string> = {
  AccessDenied: "This Google account isn't on the admin list. Ask the workspace owner to add your email.",
  Configuration: "Sign-in isn't configured on this server yet. Check the AUTH_* environment variables.",
};

function GoogleIcon() {
  return <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24"><path d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.33Z" fill="#4285F4" /><path d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.81-1.76-5.6-4.12H3.07v2.58A10 10 0 0 0 12 22Z" fill="#34A853" /><path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.52H3.07a10 10 0 0 0 0 8.96L6.4 13.9Z" fill="#FBBC05" /><path d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.52L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98Z" fill="#EA4335" /></svg>;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const destination = safeCallbackPath(callbackUrl, (await headers()).get("host"));
  const session = await auth();
  if (isAdminEmail(session?.user?.email)) redirect(destination);

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: destination });
  }

  const errorMessage = error ? errorMessages[error] ?? "Sign-in didn't complete. Please try again." : null;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-lg shadow-slate-950/15">A</div>
          <div><p className="text-sm font-semibold tracking-tight">Avataar</p><p className="text-xs text-slate-500">Outreach platform</p></div>
        </div>
        <p className="mt-10 text-xs font-semibold tracking-[0.14em] text-indigo-600 uppercase">Admin workspace</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in to manage outreach</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Campaigns, recipients and knowledge are private to approved admins. Recipients open their invitation links without signing in.</p>
        {errorMessage && <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <form action={signInWithGoogle} className="mt-8">
          <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50" type="submit"><GoogleIcon />Continue with Google</button>
        </form>
      </section>
    </main>
  );
}
