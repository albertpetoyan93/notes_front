export function keevoReturnPath(search = window.location.search) {
  const next = new URLSearchParams(search).get("next") || "";
  if (
    next.startsWith("/keevo") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    !next.includes("://")
  ) {
    return next;
  }
  return "";
}
