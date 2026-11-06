import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-access";

/**
 * Call at the top of every admin page and server action. Server actions are
 * reachable as plain POST endpoints, so each one must check the session itself.
 */
export async function requireAdmin() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || !isAdminEmail(user.email)) redirect("/login");
  return { name: user.name ?? user.email, email: user.email };
}
