export type TaskStatus = "pending" | "in_progress" | "done" | "not_required" | "failed";
export type TaskCounts = Record<TaskStatus, number>;

/**
 * How far an offboarding is. Done and "not required" both count as finished;
 * it is complete when nothing is open or failed. The company keys the person
 * held are replaced in the background by an owner's or admin's browser: that
 * is only noted (keys), it never holds the offboarding up.
 */
export const offboardingProgress = (counts: TaskCounts, keysRotated: boolean) => {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const finished = counts.done + counts.not_required;
  const percent = total === 0 ? 100 : Math.round((finished / total) * 100);
  const open = counts.pending + counts.in_progress;

  if (counts.failed > 0) return { percent, label: `${counts.failed} failed`, complete: false, keys: null };
  if (open > 0) return { percent, label: `${open} to do`, complete: false, keys: null };
  return { percent, label: "Complete", complete: true, keys: keysRotated ? "Keys replaced" : "Keys being replaced" };
};
