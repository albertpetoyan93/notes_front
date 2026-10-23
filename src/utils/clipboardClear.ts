// Clears a copied secret from the clipboard after a while, without wiping
// something the person copied afterwards.
//
// Browsers only let a page use the clipboard while its tab is in front. So:
// - in front when the time is up: clear it then (another copy in this tab
//   replaces the pending one, so it isn't wiped);
// - in the background: clear on return to the tab, but only after checking the
//   clipboard still holds our secret. That check needs the "read clipboard"
//   permission (asked for in Security settings); without it, nothing is
//   cleared on return.

const STORAGE_KEY = "keevo.clipboardClearSeconds";
export const CLEAR_OPTIONS = [0, 30, 60, 120] as const;
const DEFAULT_SECONDS = 30;
// After this, the clipboard has surely been used for something else.
const GIVE_UP_MS = 10 * 60 * 1000;

export const getClearSeconds = (): number => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return DEFAULT_SECONDS;
    const value = Number(saved);
    return (CLEAR_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_SECONDS;
  } catch {
    return DEFAULT_SECONDS;
  }
};

export const setClearSeconds = (seconds: number) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    /* Private window: the default applies. */
  }
};

// "granted" when this site may read the clipboard without asking.
export const clipboardReadPermission = async (): Promise<PermissionState | "unsupported"> => {
  try {
    const status = await navigator.permissions.query({
      name: "clipboard-read" as PermissionName,
    });
    return status.state;
  } catch {
    return "unsupported";
  }
};

// Asks for the permission; the browser shows its own prompt.
export const requestClipboardRead = async () => {
  try {
    await navigator.clipboard.readText();
  } catch {
    /* Denied, or the clipboard was empty or held no text. */
  }
  return clipboardReadPermission();
};

let pending: { text: string; timer: number; due: number; copiedAt: number } | null = null;

const clearIfStillOurs = async (returning: boolean) => {
  const current = pending;
  if (!current) return;
  if (Date.now() - current.copiedAt > GIVE_UP_MS) {
    pending = null;
    return;
  }
  if (!document.hasFocus()) return; // Try again when the tab is back in front.

  const permission = await clipboardReadPermission();
  if (permission === "granted") {
    try {
      if ((await navigator.clipboard.readText()) !== current.text) {
        pending = null; // Something else was copied since: leave it.
        return;
      }
    } catch {
      return;
    }
  } else if (returning) {
    // Can't tell whether something else was copied while away: leave it.
    pending = null;
    return;
  }

  try {
    await navigator.clipboard.writeText("");
    if (pending === current) pending = null;
  } catch {
    /* Lost focus in the meantime; the focus handler tries again. */
  }
};

/** Clears `text` from the clipboard after the chosen time. */
export const scheduleClipboardClear = (text: string) => {
  const seconds = getClearSeconds();
  if (pending) window.clearTimeout(pending.timer);
  pending = null;
  if (!seconds) return 0;
  const now = Date.now();
  pending = {
    text,
    copiedAt: now,
    due: now + seconds * 1000,
    timer: window.setTimeout(() => clearIfStillOurs(false), seconds * 1000),
  };
  return seconds;
};

/** Something else was copied in this tab: the pending secret is gone anyway. */
export const cancelClipboardClear = () => {
  if (pending) window.clearTimeout(pending.timer);
  pending = null;
};

const onReturn = () => {
  if (pending && Date.now() >= pending.due) clearIfStillOurs(true);
};

if (typeof window !== "undefined") {
  window.addEventListener("focus", onReturn);
  // Ctrl+C on the page. Our own writes don't fire this event.
  document.addEventListener("copy", cancelClipboardClear);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onReturn();
  });
}

export const clearLabel = (seconds: number) =>
  seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;
