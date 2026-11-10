import { describe, expect, it } from "vitest";
import { secretChanged } from "./secretChange";

const f = (label: string, value: string) => ({ label, value });

describe("secretChanged", () => {
  it("is true when a password gets a new value", () => {
    expect(secretChanged([f("Username", "sam"), f("Password", "old")], [f("Username", "sam"), f("Password", "new")])).toBe(true);
  });

  it("counts other secrets too (PIN, authenticator key)", () => {
    expect(secretChanged([f("PIN", "1234")], [f("PIN", "9876")])).toBe(true);
    expect(secretChanged([f("Authenticator key", "AAAA")], [f("Authenticator key", "BBBB")])).toBe(true);
  });

  it("is false when only non-secret fields change, or nothing does", () => {
    expect(secretChanged([f("Username", "sam"), f("Password", "x")], [f("Username", "max"), f("Password", "x")])).toBe(false);
    expect(secretChanged([f("Password", "x")], [f("Password", "x")])).toBe(false);
  });

  it("ignores whitespace-only edits and a password merely moved to another position", () => {
    expect(secretChanged([f("Password", "x")], [f("Password", " x ")])).toBe(false);
    expect(secretChanged([f("Password", "a"), f("URL", "u")], [f("URL", "u"), f("Password", "a")])).toBe(false);
  });

  it("is false when a secret is only removed (that's not a new password)", () => {
    expect(secretChanged([f("Password", "x"), f("PIN", "1")], [f("Password", "x")])).toBe(false);
  });

  it("is true when a secret is added where there was none", () => {
    expect(secretChanged([f("Username", "sam")], [f("Username", "sam"), f("Password", "new")])).toBe(true);
  });
});
