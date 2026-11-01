import { describe, expect, it } from "vitest";
import { decodeSource, encodeSource, sourceFromVisit } from "./signupSource";

describe("sourceFromVisit", () => {
  it("reads the UTM tags and the landing path", () => {
    expect(
      sourceFromVisit("https://2keevo.com/pricing?utm_source=instagram&utm_medium=bio&utm_campaign=launch", "")
    ).toEqual({ source: "instagram", medium: "bio", campaign: "launch", landingPath: "/pricing" });
  });

  it("keeps an outside referrer's domain, never 2keevo's own", () => {
    expect(sourceFromVisit("https://2keevo.com/", "https://www.google.com/search?q=x")).toEqual({
      referrerDomain: "google.com",
      landingPath: "/",
    });
    expect(sourceFromVisit("https://app.2keevo.com/auth/register", "https://2keevo.com/pricing")).toBeNull();
  });

  it("returns null for a plain visit", () => {
    expect(sourceFromVisit("https://app.2keevo.com/notes", "")).toBeNull();
  });
});

describe("encode/decode", () => {
  it("round-trips and rejects junk", () => {
    const source = { source: "facebook", content: "p03-reel" };
    expect(decodeSource(encodeSource(source))).toEqual(source);
    expect(decodeSource("%7Bnope")).toBeNull();
    expect(decodeSource(encodeURIComponent("[1,2]"))).toBeNull();
    expect(decodeSource(undefined)).toBeNull();
  });
});
