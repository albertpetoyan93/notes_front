import { useCallback, useEffect, useMemo, useState } from "react";
import { fetcherGet } from "../configs/axios";
import { isNoteOwner } from "../pages/notes/NoteActions";
import { useBreachAlertStore } from "../store/breachAlertStore";
import { useKeyStore } from "../store/keyStore";
import type { Note } from "../store/noteStore";
import { type Breach, type BreachAlert, matchBreaches } from "../utils/breachAlerts";
import { loadSealedSettings, saveSealedSettings, type SealedSettings } from "../utils/sealedSettings";

// The same logins the other health checks cover: your own, outside companies.
const personalLogins = (notes: Note[]) =>
  notes.filter(
    (note) =>
      isNoteOwner(note) &&
      !(note.collections || []).some((collection) => collection.companyId) &&
      !note.collection?.companyId
  );

// One download per page load is plenty: the server refreshes the list once a day.
let feed: Promise<Breach[]> | null = null;
const loadFeed = () => {
  if (!feed) {
    feed = fetcherGet("/api/breaches")
      .then((data) => (Array.isArray(data?.breaches) ? (data.breaches as Breach[]) : []))
      .catch(() => {
        feed = null;
        return [];
      });
  }
  return feed;
};

export interface BreachAlertsState {
  alerts: BreachAlert[];
  dismiss: (breachName: string) => void;
}

/**
 * Breach alerts for the personal vault (docs/features/breach-alerts.md). Matching runs here,
 * on decrypted logins; dismissals are saved encrypted. Nothing about the match reaches the server.
 */
const useBreachAlerts = (summary: Note[], enabled: boolean): BreachAlertsState => {
  const keys = useKeyStore((state) => state.keys);
  const setAlerts = useBreachAlertStore((state) => state.setAlerts);
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Everything stored in the sealed settings, so saving one key keeps the others.
  const [settings, setSettings] = useState<SealedSettings>({});

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadFeed().then((list) => alive && setBreaches(list));
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !keys) return;
    let alive = true;
    loadSealedSettings(keys.userKey)
      .then((loaded) => {
        if (!alive) return;
        setSettings(loaded);
        setDismissed(new Set(loaded.dismissedBreaches || []));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled, keys]);

  const alerts = useMemo(
    () => (enabled ? matchBreaches(breaches, personalLogins(summary), dismissed) : []),
    [enabled, breaches, summary, dismissed]
  );

  useEffect(() => setAlerts(alerts), [alerts, setAlerts]);

  const dismiss = useCallback(
    (breachName: string) => {
      const next = new Set(dismissed).add(breachName);
      setDismissed(next);
      if (!keys) return;
      // Keep only names still in the feed so the list doesn't grow forever.
      const known = new Set(breaches.map((breach) => breach.name));
      const kept = [...next].filter((name) => known.has(name) || !breaches.length);
      const updated = { ...settings, dismissedBreaches: kept };
      setSettings(updated);
      void saveSealedSettings(keys.userKey, updated).catch(() => undefined);
    },
    [dismissed, keys, breaches, settings]
  );

  return { alerts, dismiss };
};

export default useBreachAlerts;
