import { describe, expect, it } from "vitest";
import { awaitingKey, decryptionFailed } from "./noteFields";

const withContent = (content: unknown) => ({ content }) as never;

describe("awaitingKey", () => {
  it("is true only for an item whose key hasn't been handed over yet", () => {
    const waiting = withContent({ mainContent: "", customFields: [], decryptionFailed: true, awaitingKey: true });
    expect(awaitingKey(waiting)).toBe(true);
    // Still not openable, so it can't be edited meanwhile.
    expect(decryptionFailed(waiting)).toBe(true);
  });

  it("is false for an item that is really broken, and for a normal one", () => {
    expect(awaitingKey(withContent({ mainContent: "", customFields: [], decryptionFailed: true, awaitingKey: false }))).toBe(false);
    expect(awaitingKey(withContent({ mainContent: "hi", customFields: [] }))).toBe(false);
    expect(awaitingKey(withContent(null))).toBe(false);
  });
});
