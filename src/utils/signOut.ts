// Signing out reaches every open 2keevo tab of this browser (F18: "logout
// cannot leave an unlocked second tab"). Kept apart from autoLock.ts so the
// request layer (configs/axios) can use it without importing the stores.

import { forgetVaultKeys } from "../store/keyStore";

/** The localStorage key every tab listens on; autoLock uses it for lock events too. */
export const LOCK_EVENT_KEY = "keevo.lockEvent";
export const SIGNED_OUT_PREFIX = "signedOut:";

/** Tell the other tabs that this browser is signed out. */
export const announceSignedOut = () => {
  try {
    window.localStorage.setItem(LOCK_EVENT_KEY, `${SIGNED_OUT_PREFIX}${Date.now()}`);
  } catch {
    /* Private window: the other tabs find out on their next request. */
  }
};

/** Only a refused refresh (401) ends the sign-in; offline or a server error (5xx) doesn't. */
export const endsSignIn = (refreshError: { response?: { status?: number } } | null | undefined) =>
  refreshError?.response?.status === 401;

// Every page of the app, not only the signed-in layout: a tab on /keevo or
// /auth/recovery-key holds keys too, and would otherwise hand them to the extension.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === LOCK_EVENT_KEY && event.newValue?.startsWith(SIGNED_OUT_PREFIX)) forgetVaultKeys();
  });
}

/** Signed out without the person asking (the server refused): forget this tab's keys and tell the others. */
export const signedOutHere = () => {
  forgetVaultKeys();
  announceSignedOut();
};

/** A refused refresh: forget this tab's keys and tell the others always; leave for sign-in unless already there. */
export const afterRefusedRefresh = (
  pathname: string,
  search: string,
  reason: string | undefined,
  go: (target: string) => void
) => {
  signedOutHere();
  const target = loginRedirect(pathname, search, reason);
  if (target) go(target);
};

/** Where to send someone whose sign-in ended; null when they're already on a sign-in page. */
export const loginRedirect = (pathname: string, search: string, reason?: string): string | null => {
  if (pathname.startsWith("/auth/")) return null;
  const params = new URLSearchParams();
  if (pathname.startsWith("/keevo")) params.set("next", pathname + search);
  if (reason === "idle_signed_out") params.set("ended", "idle");
  const query = params.toString();
  return query ? `/auth/login?${query}` : "/auth/login";
};

/** What the sign-in page says about why it's showing. */
export const loginNotice = (ended: string | null) =>
  ended === "idle" ? "You were signed out after 12 hours without using 2keevo. Sign in again to continue." : null;
