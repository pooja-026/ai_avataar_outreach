import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/admin-access";

// Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  // Sessions live in an encrypted cookie, so no database tables are needed.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    // Runs once at login: only verified Google addresses on the allow-list get a session.
    signIn({ profile }) {
      return profile?.email_verified === true && isAdminEmail(profile.email);
    },
    // Runs in the proxy on every protected request: re-checks the allow-list, so
    // removing an email from ADMIN_EMAILS locks that admin out immediately.
    authorized({ auth }) {
      return isAdminEmail(auth?.user?.email);
    },
  },
});
