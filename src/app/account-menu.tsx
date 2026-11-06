import { signOut } from "@/auth";
import { requireAdmin } from "@/lib/auth-guard";

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Signed-in admin's name with a sign-out button. Server component. */
export async function AccountMenu() {
  const admin = await requireAdmin();
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-800">{admin.name}</p><p className="text-xs text-slate-500">{admin.email}</p></div>
      <div aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-cyan-200 to-indigo-300 text-xs font-bold text-slate-800">{initials(admin.name)}</div>
      <form action={signOutAction}><button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50" type="submit">Sign out</button></form>
    </div>
  );
}
