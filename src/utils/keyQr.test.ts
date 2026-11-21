import { describe, expect, it } from "vitest";
import { accountMatchScore } from "./accountMatch";
import { keyQrAccounts, parseTotp } from "./totp";

// A small protobuf writer for test transfer codes.
const varint = (value: number) => {
  const out: number[] = [];
  while (value > 127) {
    out.push((value & 127) | 128);
    value = Math.floor(value / 128);
  }
  out.push(value);
  return out;
};
const bytesField = (field: number, bytes: number[]) => [...varint(field * 8 + 2), ...varint(bytes.length), ...bytes];
const intField = (field: number, value: number) => [...varint(field * 8), ...varint(value)];
const utf8 = (text: string) => [...new TextEncoder().encode(text)];

const SECRET = [72, 101, 108, 108, 111, 33, 222, 173, 190, 239]; // base32 JBSWY3DPEHPK3PXP

const account = (issuer: string, name: string, type = 2) =>
  bytesField(1, [
    ...bytesField(1, SECRET),
    ...bytesField(2, utf8(name)),
    ...bytesField(3, utf8(issuer)),
    ...intField(4, 1),
    ...intField(5, 1),
    ...intField(6, type),
  ]);

const transfer = (accounts: number[][], part?: { index: number; size: number }) => {
  const payload = [
    ...accounts.flat(),
    ...intField(2, 1),
    ...intField(3, part?.size ?? 1),
    ...intField(4, part ? part.index - 1 : 0),
    ...intField(5, 77),
  ];
  const data = btoa(String.fromCharCode(...payload));
  return `otpauth-migration://offline?data=${encodeURIComponent(data)}`;
};

describe("keyQrAccounts", () => {
  it("reads a site's own QR code", () => {
    const uri = "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub";
    const qr = keyQrAccounts(uri);
    expect(qr.accounts).toHaveLength(1);
    expect(qr.accounts[0]).toMatchObject({ issuer: "GitHub", name: "alice", uri });
  });

  it("reads a transfer code with one account", () => {
    const qr = keyQrAccounts(transfer([account("GitHub", "alice@example.com")]));
    expect(qr.accounts).toHaveLength(1);
    expect(qr.part).toBeUndefined();
    const config = parseTotp(qr.accounts[0].uri);
    expect(config?.issuer).toBe("GitHub");
    expect(config?.account).toBe("alice@example.com");
  });

  it("reads a transfer code with several accounts and its part number", () => {
    const qr = keyQrAccounts(
      transfer([account("GitHub", "alice"), account("Dropbox", "bob"), account("Bank", "me", 1)], {
        index: 2,
        size: 3,
      })
    );
    expect(qr.accounts.map((item) => item.issuer)).toEqual(["GitHub", "Dropbox", "Bank"]);
    expect(qr.accounts[2].uri).toBe("");
    expect(qr.accounts[2].problem).toMatch(/HOTP/);
    expect(qr.part).toEqual({ index: 2, size: 3 });
  });

  it("rejects QR codes that are not authenticator codes", () => {
    expect(() => keyQrAccounts("https://example.com")).toThrow(/not an authenticator code/);
  });
});

describe("accountMatchScore", () => {
  const item = {
    title: "GitHub",
    fields: [
      { label: "Username", value: "alice" },
      { label: "URL", value: "https://github.com" },
    ],
  };

  it("prefers the account whose site and name fit the item", () => {
    const github = accountMatchScore(item, { issuer: "GitHub", name: "alice" });
    const otherUser = accountMatchScore(item, { issuer: "GitHub", name: "bob" });
    const dropbox = accountMatchScore(item, { issuer: "Dropbox", name: "bob" });
    expect(github).toBeGreaterThan(otherUser);
    expect(otherUser).toBeGreaterThan(dropbox);
    expect(dropbox).toBe(0);
  });

  it("matches on the URL when the title differs", () => {
    expect(accountMatchScore({ title: "Work code host", fields: item.fields }, { issuer: "GitHub", name: "" })).toBe(2);
  });
});
