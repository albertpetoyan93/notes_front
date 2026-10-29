import { useEffect } from "react";
import { fetcherPost } from "../configs/axios";
import { useAuthStore } from "../store/authStore";
import { useLockStore } from "../store/lockStore";
import {
  DEFAULT_AUTO_LOCK_MINUTES,
  LOCK_STORAGE_KEYS,
  lastActivity,
  lockVault,
  noteActivity,
  onLockEvent,
} from "../utils/autoLock";

const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
// Tell the server about activity at most this often; it allows for the gap.
const SERVER_PING_MS = 60 * 1000;

/**
 * Locks the vault after the signed-in person's idle time. Only real input
 * counts: background requests such as notifications don't keep it open.
 */
const useAutoLock = (signedIn: boolean) => {
  useEffect(() => {
    if (!signedIn) return undefined;
    let lastPing = Date.now();
    noteActivity();

    const onInput = () => {
      const now = Date.now();
      noteActivity(now);
      if (!useLockStore.getState().locked && now - lastPing > SERVER_PING_MS) {
        lastPing = now;
        fetcherPost("/api/auth/session/active", {}).catch(() => undefined);
      }
    };

    const check = () => {
      if (useLockStore.getState().locked) return;
      const me = useAuthStore.getState().me;
      const own: number = me?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES;
      // A company limit wins over a longer (or "never") personal choice, as on the server.
      const limit: number | null = me?.autoLockLimit ?? null;
      const minutes = limit ? (own > 0 ? Math.min(own, limit) : limit) : own;
      if (minutes > 0 && Date.now() - lastActivity() > minutes * 60 * 1000) lockVault();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCK_STORAGE_KEYS.event) onLockEvent(event.newValue);
    };

    INPUT_EVENTS.forEach((name) => window.addEventListener(name, onInput, { passive: true }));
    window.addEventListener("storage", onStorage);
    // A laptop waking up: check at once instead of waiting for the timer.
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 10 * 1000);
    return () => {
      INPUT_EVENTS.forEach((name) => window.removeEventListener(name, onInput));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [signedIn]);
};

export default useAutoLock;
