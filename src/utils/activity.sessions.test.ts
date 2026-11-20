import { describe, expect, it, vi } from "vitest";

vi.mock("../configs/axios", () => ({ fetcherPost: vi.fn() }));
import { describeActivity, isNotableActivity } from "./activity";

describe("F18: a reused sign-in in the activity log", () => {
  it("says what happened in plain words, and is shown as a warning", () => {
    const event = { action: "session_token_reused", details: { kind: "extension" } } as never;
    expect(describeActivity(event)).toBe(
      "— an old sign-in to the browser extension was used again, so it was signed out"
    );
    expect(describeActivity({ action: "session_token_reused", details: { kind: "web" } } as never)).toBe(
      "— an old sign-in was used again, so it was signed out"
    );
    expect(isNotableActivity("session_token_reused")).toBe(true);
    expect(
      describeActivity({ action: "session_token_reused", details: { kind: "extension", likelyLostAnswer: true } } as never)
    ).toBe(
      "— the browser extension's sign-in ended: an old sign-in was used again from the same device (probably a lost connection)"
    );
  });
});
