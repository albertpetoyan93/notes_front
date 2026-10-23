// Auto-lock after idle time. The server keeps the real lock (a locked session
// can't read the vault); this side notices idle time, shows the lock screen,
// and keeps every open 2keevo tab in step.

import { fetcherPost } from "../configs/axios";
import { useLockStore } from "../store/lockStore";
import { useNoteStore } from "../store/noteStore";
import { useVaultStore } from "../store/vaultStore";

export const AUTO_LOCK_CHOICES = [5, 15, 30, 60, 0] as const;
export const DEFAULT_AUTO_LOCK_MINUTES = 15;

const ACTIVITY_KEY = "keevo.lastActivity";
const LOCK_EVENT_KEY = "keevo.lockEvent";

export const autoLockLabel = (minutes: number) =>
  minutes === 0 ? "Never" : minutes === 60 ? "After 1 hour" : `After ${minutes} minutes`;

let lastLocalActivity = Date.now();

/** Input in this tab: remember it, and share it with the other tabs. */
export const noteActivity = (now = Date.now()) => {
  const previous = lastLocalActivity;
  lastLocalActivity = now;
  if (now - previous < 5000) return;
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {
    /* Private window: this tab still counts its own activity. */
  }
};

/** The latest input in any 2keevo tab of this browser. */
export const lastActivity = () => {
  let shared = 0;
  try {
    shared = Number(window.localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    /* Ignored. */
  }
  return Math.max(lastLocalActivity, shared);
};

const announce = (state: "locked" | "unlocked") => {
  try {
    window.localStorage.setItem(LOCK_EVENT_KEY, `${state}:${Date.now()}`);
  } catch {
    /* Other tabs find out on their next request instead. */
  }
};

/** Drop loaded items from memory, so nothing readable stays in the page. */
export const forgetVaultData = () => {
  useVaultStore.setState({ summary: [], collections: [], loaded: false });
  useNoteStore.setState({ notes: [] });
};

export const showLocked = () => {
  if (useLockStore.getState().locked) return;
  useLockStore.getState().setLocked(true);
  forgetVaultData();
};

/** Lock now: on the server, in this tab, and in the other tabs. */
export const lockVault = async () => {
  showLocked();
  announce("locked");
  try {
    await fetcherPost("/api/auth/lock", {});
  } catch {
    /* Already signed out or offline: the lock screen is shown anyway. */
  }
};

export const afterUnlock = () => {
  lastLocalActivity = Date.now();
  useLockStore.getState().setLocked(false);
  announce("unlocked");
};

/** Another tab locked or unlocked. */
export const onLockEvent = (value: string | null) => {
  if (!value) return;
  if (value.startsWith("locked:")) showLocked();
  else if (value.startsWith("unlocked:")) {
    lastLocalActivity = Date.now();
    useLockStore.getState().setLocked(false);
  }
};

export const LOCK_STORAGE_KEYS = { activity: ACTIVITY_KEY, event: LOCK_EVENT_KEY };
