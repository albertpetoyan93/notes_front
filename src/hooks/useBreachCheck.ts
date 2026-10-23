import { useCallback, useEffect, useRef, useState } from "react";
import { fetcherGet, fetcherPost } from "../configs/axios";
import { isNoteOwner } from "../pages/notes/NoteActions";
import type { Note } from "../store/noteStore";
import { leakCounts } from "../utils/breachCheck";
import { categoryKey } from "../utils/noteCategory";
import { noteFields } from "../utils/noteFields";

// Leak lists grow, so everything is checked again after a week.
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

interface BreachStatus {
  checkedAt: string | null;
  results: { noteId: number; checkedAt: string }[];
}

export interface BreachCheckState {
  running: boolean;
  done: number;
  total: number;
  checkedAt: string | null;
  error: string;
  checkNow: () => void;
}

// The same logins the other health checks cover: your own, outside companies.
const personalLogins = (notes: Note[]) =>
  notes.filter(
    (note) =>
      categoryKey(note.category) === "password" &&
      isNoteOwner(note) &&
      !(note.collections || []).some((collection) => collection.companyId) &&
      !note.collection?.companyId
  );

// Same rule as the API's password health: fields whose name contains "pass".
const passwordsOf = (note: Note) =>
  noteFields(note)
    .filter((field) => /pass/i.test(field.label) && field.value)
    .map((field) => field.value);

/**
 * Runs the leaked-password check while the Security health page is open:
 * new or changed logins right away, everything once a week, or on request.
 */
const useBreachCheck = (summary: Note[], active: boolean, onSaved: () => void) => {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);
  const summaryRef = useRef(summary);
  summaryRef.current = summary;

  const run = useCallback(
    async (notes: Note[]) => {
      const withPasswords = notes.filter((note) => passwordsOf(note).length);
      if (!withPasswords.length) return;
      setRunning(true);
      setError("");
      setDone(0);
      try {
        const counts = await leakCounts(withPasswords.flatMap(passwordsOf), (current, all) => {
          setDone(current);
          setTotal(all);
        });
        const results = withPasswords.map((note) => ({
          noteId: note.id,
          count: Math.max(...passwordsOf(note).map((password) => counts.get(password) || 0)),
        }));
        await fetcherPost("/api/notes/health/breaches", { results });
        setCheckedAt(new Date().toISOString());
        onSaved();
      } catch (checkError: any) {
        setError(
          checkError?.message?.includes("Failed to fetch")
            ? "Could not reach the leak check service. Check your connection and try again."
            : checkError?.message || "The leak check did not finish."
        );
      } finally {
        setRunning(false);
      }
    },
    [onSaved]
  );

  useEffect(() => {
    if (!active || started.current || !summary.length) return;
    started.current = true;
    (async () => {
      try {
        const status: BreachStatus = await fetcherGet("/api/notes/health/breaches");
        setCheckedAt(status.checkedAt);
        const logins = personalLogins(summaryRef.current);
        const fullCheckDue =
          !status.checkedAt || Date.now() - new Date(status.checkedAt).getTime() > RECHECK_MS;
        if (fullCheckDue) {
          await run(logins);
          return;
        }
        const checked = new Map(
          status.results.map((row) => [row.noteId, new Date(row.checkedAt).getTime()])
        );
        const changed = logins.filter((note) => {
          const at = checked.get(note.id);
          return at === undefined || new Date(note.updatedAt).getTime() > at;
        });
        if (changed.length) await run(changed);
      } catch {
        // The page still works without it; "Check now" tries again.
      }
    })();
  }, [active, summary.length, run]);

  const checkNow = useCallback(() => {
    if (!running) run(personalLogins(summaryRef.current));
  }, [run, running]);

  return { running, done, total, checkedAt, error, checkNow } satisfies BreachCheckState;
};

export default useBreachCheck;
