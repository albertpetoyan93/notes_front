/** "Later" on the confirm-email banner hides it for this long. */
export const CONFIRM_BANNER_SNOOZE_MS = 24 * 60 * 60 * 1000;
export const CONFIRM_BANNER_KEY = "2keevo.confirmEmailLater";

/**
 * Show the "confirm your email" banner? Only when /me says the address isn't
 * confirmed (an older backend without the field never nags), and not within
 * 24 h of "Later".
 */
export const showConfirmBanner = (
  me: { emailVerified?: boolean } | null | undefined,
  dismissedAt: number | null,
  now: number
) => {
  if (!me || me.emailVerified !== false) return false;
  return dismissedAt == null || now - dismissedAt >= CONFIRM_BANNER_SNOOZE_MS;
};

/** The confirmed address belongs to whoever is signed in here (a link can be opened in another account's browser). */
export const confirmedSignedInAccount = (me: { email?: string } | null | undefined, confirmedEmail: string) =>
  !!me?.email && me.email.trim().toLowerCase() === confirmedEmail.trim().toLowerCase();
