import { describe, expect, it } from "vitest";
import { offboardingProgress, type TaskCounts } from "./offboardingProgress";

const counts = (part: Partial<TaskCounts>): TaskCounts => ({
  pending: 0,
  in_progress: 0,
  done: 0,
  not_required: 0,
  failed: 0,
  ...part,
});

describe("offboardingProgress", () => {
  it("everything done and keys replaced -> Complete, keys replaced", () => {
    expect(offboardingProgress(counts({ done: 3, not_required: 1 }), true)).toEqual({
      percent: 100,
      label: "Complete",
      complete: true,
      keys: "Keys replaced",
    });
  });

  it("no tasks at all -> Complete", () => {
    expect(offboardingProgress(counts({}), true)).toEqual({ percent: 100, label: "Complete", complete: true, keys: "Keys replaced" });
  });

  it("tasks finished while the person still holds company keys -> still Complete; keys only noted", () => {
    expect(offboardingProgress(counts({ done: 2 }), false)).toEqual({
      percent: 100,
      label: "Complete",
      complete: true,
      keys: "Keys being replaced",
    });
  });

  it("open tasks -> '{n} to do' counting pending and in progress, no keys note yet", () => {
    expect(offboardingProgress(counts({ pending: 2, in_progress: 1, done: 1, not_required: 1 }), false)).toEqual({
      percent: 40,
      label: "3 to do",
      complete: false,
      keys: null,
    });
  });

  it("failed tasks -> '{n} failed' (before the to-do count)", () => {
    expect(offboardingProgress(counts({ pending: 1, failed: 2, done: 1 }), true)).toEqual({
      percent: 25,
      label: "2 failed",
      complete: false,
      keys: null,
    });
  });

  it("rounds the percent", () => {
    expect(offboardingProgress(counts({ pending: 2, done: 1 }), true).percent).toBe(33);
  });
});
