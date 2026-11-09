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
  it("everything done and keys rotated -> Complete", () => {
    expect(offboardingProgress(counts({ done: 3, not_required: 1 }), true)).toEqual({
      percent: 100,
      label: "Complete",
      complete: true,
    });
  });

  it("no tasks at all and keys rotated -> Complete", () => {
    expect(offboardingProgress(counts({}), true)).toEqual({ percent: 100, label: "Complete", complete: true });
  });

  it("tasks finished but the person still holds company keys -> waiting for an admin", () => {
    expect(offboardingProgress(counts({ done: 2 }), false)).toEqual({
      percent: 100,
      label: "Waiting for an admin to open 2keevo (vault keys)",
      complete: false,
    });
  });

  it("open tasks -> '{n} to do' counting pending and in progress", () => {
    expect(offboardingProgress(counts({ pending: 2, in_progress: 1, done: 1, not_required: 1 }), true)).toEqual({
      percent: 40,
      label: "3 to do",
      complete: false,
    });
  });

  it("failed tasks -> '{n} failed' (before the to-do count)", () => {
    expect(offboardingProgress(counts({ pending: 1, failed: 2, done: 1 }), true)).toEqual({
      percent: 25,
      label: "2 failed",
      complete: false,
    });
  });

  it("rounds the percent", () => {
    expect(offboardingProgress(counts({ pending: 2, done: 1 }), true).percent).toBe(33);
  });
});
