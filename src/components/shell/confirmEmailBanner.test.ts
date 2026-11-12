import { describe, expect, it } from "vitest";
import { showConfirmBanner } from "./confirmEmailRule";

const NOW = new Date("2026-11-12T10:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

describe("showConfirmBanner", () => {
  it("shows for an account that hasn't confirmed its email", () => {
    expect(showConfirmBanner({ emailVerified: false }, null, NOW)).toBe(true);
  });

  it("never shows once confirmed, or before /me is known", () => {
    expect(showConfirmBanner({ emailVerified: true }, null, NOW)).toBe(false);
    expect(showConfirmBanner(null, null, NOW)).toBe(false);
    // An older backend without the field: don't nag.
    expect(showConfirmBanner({}, null, NOW)).toBe(false);
  });

  it("hides for 24 h after Later", () => {
    expect(showConfirmBanner({ emailVerified: false }, NOW - 23 * HOUR, NOW)).toBe(false);
    expect(showConfirmBanner({ emailVerified: false }, NOW - 25 * HOUR, NOW)).toBe(true);
  });
});

describe("confirmedSignedInAccount", () => {
  it("only the signed-in account whose address was confirmed loses the banner", async () => {
    const { confirmedSignedInAccount } = await import("./confirmEmailRule");
    expect(confirmedSignedInAccount({ email: "Sam@Acme.com" }, "sam@acme.com")).toBe(true);
    expect(confirmedSignedInAccount({ email: "pat@acme.com" }, "sam@acme.com")).toBe(false);
    expect(confirmedSignedInAccount(null, "sam@acme.com")).toBe(false);
  });
});
