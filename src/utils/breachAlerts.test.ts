import { describe, expect, it } from "vitest";
import type { Note } from "../store/noteStore";
import { leakedSummary, loginDomains, matchBreaches, type Breach } from "./breachAlerts";
import { rootHost } from "./rootHost";

const note = (id: number, fields: Record<string, string>, extra: Partial<Note> = {}): Note =>
  ({
    id,
    title: `Item ${id}`,
    category: "password",
    content: { customFields: Object.entries(fields).map(([label, value]) => ({ label, value })) },
    isFavorite: false,
    userId: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    ...extra,
  }) as unknown as Note;

const breach = (name: string, domain: string, addedDate = "2026-11-20T00:00:00Z"): Breach => ({
  name,
  title: name,
  domain,
  breachDate: "2026-11-18",
  addedDate,
  pwnCount: 1000,
  dataClasses: ["Email addresses", "Passwords"],
  isVerified: true,
});

describe("rootHost", () => {
  it("matches the extension's rule", () => {
    expect(rootHost("https://www.login.tower.co.jp/x")).toBe("tower.co.jp");
    expect(rootHost("accounts.example.com")).toBe("example.com");
    expect(rootHost("user@shop.example.com")).toBe("example.com");
  });
});

describe("loginDomains", () => {
  it("reads URL fields and passkey sites, not usernames or emails", () => {
    const item = note(1, {
      Username: "mara@northwind.example.com",
      Password: "x",
      URL: "https://www.spotify.com/login",
      Website: "app.figma.com",
      Notes: "see docs.example.org later",
    });
    (item.content as any).passkeys = [{ credentialId: "c", rpId: "github.com", userName: "m", createdAt: "" }];
    expect(loginDomains(item).sort()).toEqual(["figma.com", "github.com", "spotify.com"]);
  });
});

describe("matchBreaches", () => {
  const spotify = note(1, { URL: "https://open.spotify.com" });
  const changedSince = note(2, { URL: "spotify.com" }, { updatedAt: "2026-11-21T00:00:00Z" } as Partial<Note>);
  const other = note(3, { URL: "https://example.org" });
  const aNote = note(4, { URL: "https://spotify.com" }, { category: "note" } as Partial<Note>);
  const noUrl = note(5, { Password: "x" });

  it("flags logins on the breached site whose password is older than the report", () => {
    const alerts = matchBreaches([breach("Spotify", "spotify.com")], [spotify, changedSince, other, aNote, noUrl], new Set());
    expect(alerts).toHaveLength(1);
    expect(alerts[0].items.map((item) => item.id)).toEqual([1]);
  });

  it("leaves out dismissed breaches and breaches with no matching login", () => {
    expect(matchBreaches([breach("Spotify", "spotify.com")], [spotify], new Set(["Spotify"]))).toEqual([]);
    expect(matchBreaches([breach("Tower", "tower.co.jp")], [spotify], new Set())).toEqual([]);
  });

  it("puts the newest breach first", () => {
    const alerts = matchBreaches(
      [breach("Old", "example.org", "2026-01-02T00:00:00Z"), breach("Spotify", "spotify.com")],
      [spotify, note(6, { URL: "example.org" }, { updatedAt: "2025-01-01T00:00:00Z" } as Partial<Note>)],
      new Set()
    );
    expect(alerts.map((alert) => alert.breach.name)).toEqual(["Spotify", "Old"]);
  });
});

describe("leakedSummary", () => {
  it("names the important data first", () => {
    expect(leakedSummary(["Email addresses", "Passwords"])).toBe("Passwords and email addresses");
    expect(leakedSummary(["Passwords", "Email addresses", "IP addresses", "Dates of birth"])).toBe(
      "Passwords, email addresses and 2 more"
    );
    expect(leakedSummary(["IP addresses"])).toBe("1 kind of data");
  });
});
