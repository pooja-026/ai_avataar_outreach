/**
 * Admin allow-list. Only Google accounts listed in ADMIN_EMAILS (comma-separated)
 * may manage campaigns. An empty or missing list lets nobody in (fail closed).
 */
export function adminEmails(raw = process.env.ADMIN_EMAILS ?? "") {
  return raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, raw?: string) {
  if (!email) return false;
  return adminEmails(raw).includes(email.trim().toLowerCase());
}

/**
 * Only same-site destinations may be used after login (prevents open redirects).
 * Accepts a relative path, or an absolute URL whose host is this site's host
 * (Auth.js passes callbackUrl as an absolute URL).
 */
export function safeCallbackPath(value: string | null | undefined, currentHost?: string | null) {
  if (!value) return "/";
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!currentHost || url.host !== currentHost) return "/";
      path = `${url.pathname}${url.search}`;
    } catch {
      return "/";
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (path.startsWith("/login") || path.startsWith("/api/auth")) return "/";
  return path;
}
