import { describe, expect, it } from "vitest";
import {
  DEFAULT_KDF,
  E2EError,
  decryptBytes,
  decryptJson,
  deriveAuthKey,
  deriveMasterKey,
  deriveRecoveryWrappingKey,
  deriveWrappingKey,
  encryptBytes,
  encryptJson,
  fingerprint,
  fromB64url,
  generateKeyPair,
  newRecoveryKey,
  newSymmetricKey,
  normalizeRecoveryKey,
  openSealed,
  privateKeyFromRaw,
  sealTo,
  sharedSecret,
  testing,
  toB64url,
  unwrapKey,
  wrapKey,
} from "./e2e";
// Computed with independent implementations (the Argon2 C reference library
// and OpenSSL, via Python), plus the RFC 5869, GCM spec and RFC 7748 vectors.
import vectors from "./e2e.vectors.json";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const unhex = (text: string) => new Uint8Array(Buffer.from(text, "hex"));
const text = (value: string) => new TextEncoder().encode(value);

const fails = async (promise: Promise<unknown>, code: E2EError["code"]) => {
  await expect(promise).rejects.toBeInstanceOf(E2EError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe("known answers", () => {
  it("Argon2id matches the reference implementation (with NFKC)", async () => {
    const v = vectors.argon2id;
    const key = await deriveMasterKey(v.password, unhex(v.salt), {
      algorithm: "argon2id",
      memory: v.memory,
      iterations: v.iterations,
      parallelism: v.parallelism,
    });
    expect(hex(key)).toBe(v.hash);
  }, 30000);

  it("HKDF-SHA256 matches RFC 5869 test case 1", async () => {
    const v = vectors.hkdf;
    const okm = await testing.hkdf(unhex(v.ikm), unhex(v.info), unhex(v.salt), 42);
    expect(hex(okm)).toBe(v.okm);
  });

  it("auth and wrapping keys match the reference", async () => {
    const mk = unhex(vectors.derive.masterKey);
    expect(hex(await deriveAuthKey(mk))).toBe(vectors.derive.auth);
    expect(hex(await deriveWrappingKey(mk))).toBe(vectors.derive.wrap);
    expect(vectors.derive.auth).not.toBe(vectors.derive.wrap);
  });

  it("AES-256-GCM matches the GCM spec test case 16", async () => {
    const v = vectors.aesgcm;
    const sealed = await testing.aesGcm(unhex(v.key), unhex(v.iv), unhex(v.plain), unhex(v.aad));
    expect(hex(sealed)).toBe(v.sealed);
  });

  it("X25519 matches RFC 7748 section 6.1, both ways", async () => {
    const v = vectors.x25519;
    const alice = privateKeyFromRaw(unhex(v.alicePrivate));
    const bob = privateKeyFromRaw(unhex(v.bobPrivate));
    expect(hex(await sharedSecret(alice, unhex(v.bobPublic)))).toBe(v.shared);
    expect(hex(await sharedSecret(bob, unhex(v.alicePublic)))).toBe(v.shared);
  });
});

describe("master password", () => {
  it("same password and salt give the same key; another salt does not", async () => {
    const fast = { ...DEFAULT_KDF, memory: 32 * 1024, iterations: 2 };
    const salt = new Uint8Array(16).fill(7);
    const a = await deriveMasterKey("hunter2-but-longer", salt, fast);
    const b = await deriveMasterKey("hunter2-but-longer", salt, fast);
    const c = await deriveMasterKey("hunter2-but-longer", new Uint8Array(16).fill(8), fast);
    expect(hex(a)).toBe(hex(b));
    expect(hex(a)).not.toBe(hex(c));
  }, 30000);

  it("refuses parameters a tampered server could send", async () => {
    const salt = new Uint8Array(16);
    await fails(deriveMasterKey("x", salt, { ...DEFAULT_KDF, memory: 1024 }), "weak-params");
    await fails(deriveMasterKey("x", salt, { ...DEFAULT_KDF, iterations: 1 }), "weak-params");
    await fails(deriveMasterKey("x", new Uint8Array(8)), "bad-key");
  });
});

describe("symmetric encryption", () => {
  const key = newSymmetricKey();

  it("round-trips bytes and JSON", async () => {
    const token = await encryptBytes(key, text("secret"), "item:1:content");
    expect(token.startsWith("e2e1.")).toBe(true);
    expect(new TextDecoder().decode(await decryptBytes(key, token, "item:1:content"))).toBe("secret");
    const value = { title: "GitHub", fields: [{ label: "Password", value: "p@ss ✓" }] };
    expect(await decryptJson(key, await encryptJson(key, value, "c"), "c")).toEqual(value);
  });

  it("never reuses a nonce", async () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 500; i++) ivs.add((await encryptBytes(key, text("x"))).split(".")[1]);
    expect(ivs.size).toBe(500);
  });

  it("refuses the wrong key, the wrong context, and changed data", async () => {
    const token = await encryptBytes(key, text("secret"), "item:1:content");
    await fails(decryptBytes(newSymmetricKey(), token, "item:1:content"), "decrypt-failed");
    // A server swapping item 1's data into item 2 is caught.
    await fails(decryptBytes(key, token, "item:2:content"), "decrypt-failed");
    const [v, iv, body] = token.split(".");
    const bytes = fromB64url(body);
    bytes[0] ^= 1;
    await fails(decryptBytes(key, `${v}.${iv}.${toB64url(bytes)}`, "item:1:content"), "decrypt-failed");
  });

  it("explains bad input without decrypting anything", async () => {
    await fails(decryptBytes(key, "v2:2:abc:def:ghi"), "bad-format");
    await fails(decryptBytes(key, "e2e9.aaaa.bbbb"), "unsupported-version");
    await fails(decryptBytes(key, "e2e1.@@.bb"), "bad-format");
    await fails(encryptBytes(new Uint8Array(16), text("x")), "bad-key");
  });

  it("wraps and unwraps keys, bound to their place", async () => {
    const userKey = newSymmetricKey();
    const itemKey = newSymmetricKey();
    const wrapped = await wrapKey(userKey, itemKey, "item:7");
    expect(hex(await unwrapKey(userKey, wrapped, "item:7"))).toBe(hex(itemKey));
    await fails(unwrapKey(userKey, wrapped, "item:8"), "decrypt-failed");
  });
});

describe("sharing with key pairs", () => {
  it("only the recipient's private key opens a sealed key", async () => {
    const ana = await generateKeyPair();
    const eve = await generateKeyPair();
    const itemKey = newSymmetricKey();
    const sealed = await sealTo(ana.publicKey, itemKey, "share:item:3");
    expect(sealed.startsWith("e2e1x.")).toBe(true);
    expect(hex(await openSealed(ana.privateKey, ana.publicKey, sealed, "share:item:3"))).toBe(hex(itemKey));
    await fails(openSealed(eve.privateKey, eve.publicKey, sealed, "share:item:3"), "decrypt-failed");
    await fails(openSealed(ana.privateKey, ana.publicKey, sealed, "share:item:4"), "decrypt-failed");
  });

  it("sealing the same key twice looks different (fresh ephemeral key)", async () => {
    const ana = await generateKeyPair();
    const key = newSymmetricKey();
    expect(await sealTo(ana.publicKey, key)).not.toBe(await sealTo(ana.publicKey, key));
  });

  it("refuses a degenerate public key", async () => {
    await fails(sealTo(toB64url(new Uint8Array(32)), newSymmetricKey()), "bad-key");
  });

  it("fingerprints are stable, short and different per key", async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    const fa = await fingerprint(a.publicKey);
    expect(fa).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);
    expect(await fingerprint(a.publicKey)).toBe(fa);
    expect(await fingerprint(b.publicKey)).not.toBe(fa);
  });
});

describe("recovery key", () => {
  it("is 8 groups of 4 and forgiving to type", async () => {
    const key = newRecoveryKey();
    expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){7}$/);
    const typed = key.toLowerCase().replace(/-/g, " ");
    expect(normalizeRecoveryKey(typed)).toBe(key.replace(/-/g, ""));
    expect(hex(await deriveRecoveryWrappingKey(typed))).toBe(hex(await deriveRecoveryWrappingKey(key)));
    expect(() => normalizeRecoveryKey("ABCD-EFGH")).toThrow(E2EError);
  });
});

describe("the whole chain", () => {
  it("password → user key → private key → shared item → recipient reads it", async () => {
    const fast = { ...DEFAULT_KDF, memory: 32 * 1024, iterations: 2 };

    // Owner signs up: what the server ends up storing is only wrapped values.
    const salt = new Uint8Array(16).fill(1);
    const ownerMk = await deriveMasterKey("owner master password", salt, fast);
    const ownerUserKey = newSymmetricKey();
    const ownerPair = await generateKeyPair();
    const stored = {
      userKey: await wrapKey(await deriveWrappingKey(ownerMk), ownerUserKey, "user-key"),
      privateKey: await wrapKey(ownerUserKey, ownerPair.privateKey, "private-key"),
      publicKey: ownerPair.publicKey,
    };

    // Owner creates an item and shares it with Ana.
    const ana = await generateKeyPair();
    const itemKey = newSymmetricKey();
    const item = await encryptJson(itemKey, { title: "AWS", fields: [{ label: "Password", value: "s3cr3t" }] }, "item:9");
    const forOwner = await wrapKey(ownerUserKey, itemKey, "item:9");
    const forAna = await sealTo(ana.publicKey, itemKey, "share:item:9");

    // Owner signs in elsewhere with only the password and the stored values.
    const mk2 = await deriveMasterKey("owner master password", salt, fast);
    const userKey2 = await unwrapKey(await deriveWrappingKey(mk2), stored.userKey, "user-key");
    const privateKey2 = await unwrapKey(userKey2, stored.privateKey, "private-key");
    expect(hex(privateKey2)).toBe(hex(ownerPair.privateKey));
    const ownerItemKey = await unwrapKey(userKey2, forOwner, "item:9");
    expect(await decryptJson(ownerItemKey, item, "item:9")).toMatchObject({ title: "AWS" });

    // Ana opens it with her own private key.
    const anaItemKey = await openSealed(ana.privateKey, ana.publicKey, forAna, "share:item:9");
    expect(await decryptJson(anaItemKey, item, "item:9")).toMatchObject({ fields: [{ value: "s3cr3t" }] });

    // A wrong master password opens nothing.
    const wrongMk = await deriveMasterKey("owner master pasword", salt, fast);
    await fails(unwrapKey(await deriveWrappingKey(wrongMk), stored.userKey, "user-key"), "decrypt-failed");
  }, 60000);
});

describe("JavaScript X25519 (browsers without it built in)", () => {
  const withJs = async <T>(run: () => Promise<T>) => {
    testing.useJsX25519(true);
    try {
      return await run();
    } finally {
      testing.useJsX25519(false);
    }
  };

  it("matches RFC 7748 too", async () => {
    const v = vectors.x25519;
    const shared = await withJs(() =>
      sharedSecret(privateKeyFromRaw(unhex(v.alicePrivate)), unhex(v.bobPublic))
    );
    expect(hex(shared)).toBe(v.shared);
  });

  it("works with keys and seals made by the built-in one, both ways", async () => {
    const key = newSymmetricKey();
    // Made in Chrome, opened on an older iPhone.
    const native = await generateKeyPair();
    const sealedNative = await sealTo(native.publicKey, key, "x");
    expect(hex(await withJs(() => openSealed(native.privateKey, native.publicKey, sealedNative, "x")))).toBe(hex(key));
    // Made on the iPhone, opened in Chrome.
    const js = await withJs(() => generateKeyPair());
    const sealedJs = await withJs(() => sealTo(js.publicKey, key, "x"));
    expect(hex(await openSealed(js.privateKey, js.publicKey, sealedJs, "x"))).toBe(hex(key));
  });

  it("refuses a degenerate public key", async () => {
    await withJs(() => fails(sealTo(toB64url(new Uint8Array(32)), newSymmetricKey()), "bad-key"));
  });
});
