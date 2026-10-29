/**
 * Where to go after signing in or creating an account: `?next=` when it's a page of this
 * app (the extension's /keevo connect page, or Billing with a plan picked on the website).
 * Only same-site paths, never another origin.
 */
export function returnPath(search = window.location.search) {
  const next = new URLSearchParams(search).get("next") || "";
  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/auth") &&
    !next.includes("\\") &&
    !next.includes("://")
  ) {
    return next;
  }
  return "";
}
