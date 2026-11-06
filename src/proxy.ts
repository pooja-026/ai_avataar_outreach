// Optimistic first filter: logged-out visitors to admin pages are sent to /login.
// Every admin page and server action also calls requireAdmin(), because the proxy
// alone is not a security boundary.
export { auth as proxy } from "@/auth";

export const config = {
  // Public: Auth.js endpoints, the login page, recipient invitation pages and their
  // avatar APIs (the secret link token is the recipient's credential), and static assets.
  matcher: ["/((?!api/auth|api/recipient-links|r/|login|_next/static|_next/image|favicon.ico).*)"],
};
