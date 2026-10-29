// End-to-end encryption core (E2E_DESIGN.md). Everything that encrypts or
// decrypts vault data goes through here. It uses only the browser's built-in
// crypto (WebCrypto) plus Argon2id from hash-wasm, and nothing from the page,
// so the extension's background worker can use the same code.
//
// Keys:   master password ─Argon2id→ master key ─HKDF→ auth key (sent to sign in)
//                                                  └HKDF→ wrapping key → user key
//         user key → private key (X25519), item keys, collection keys
//
// Formats (base64url, "." separated, versioned so they can change later):
//   e2e1.<iv>.<ciphertext+tag>                     AES-256-GCM with a symmetric key
//   e2e1x.<ephemeral public>.<iv>.<ciphertext+tag> sealed to someone's public key

import { x25519 } from "@noble/curves/ed25519";
import { argon2id } from "hash-wasm";

// ---------------------------------------------------------------- encoding

export const toB64url = (bytes: Uint8Array) => {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromB64url = (text: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new E2EError("bad-format");
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder("utf-8", { fatal: true });

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** Errors carry a code, never key material. */
export class E2EError extends Error {
  constructor(
    public code:
      | "bad-format"
      | "bad-key"
      | "decrypt-failed"
      | "unsupported-version"
      | "weak-params"
  ) {
    super(`E2E: ${code}`);
  }
}

// ---------------------------------------------------------------- random

export const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

/** A fresh 256-bit symmetric key: user key, item key, collection key. */
export const newSymmetricKey = () => randomBytes(32);

// ---------------------------------------------------------------- master password

export interface KdfParams {
  algorithm: "argon2id";
  /** Memory in KiB. */
  memory: number;
  iterations: number;
  parallelism: number;
}

/** The design's defaults: 64 MiB, 3 passes, 1 lane. Stored per account, so they can rise. */
export const DEFAULT_KDF: KdfParams = {
  algorithm: "argon2id",
  memory: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

// Refuse parameters a tampered server could send to make guessing cheap.
const MIN_KDF = { memory: 32 * 1024, iterations: 2 };

/**
 * Master key from the master password. Slow on purpose (about a second): it
 * makes guessing a password from stolen data slow. The password is NFKC
 * normalised, so the same password typed on any device gives the same key.
 */
export const deriveMasterKey = async (
  password: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF
): Promise<Uint8Array> => {
  if (
    params.algorithm !== "argon2id" ||
    params.memory < MIN_KDF.memory ||
    params.iterations < MIN_KDF.iterations ||
    params.parallelism < 1
  ) {
    throw new E2EError("weak-params");
  }
  if (salt.length < 16) throw new E2EError("bad-key");
  return argon2id({
    password: password.normalize("NFKC"),
    salt,
    memorySize: params.memory,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
};

const hkdf = async (
  keyMaterial: Uint8Array,
  info: string | Uint8Array,
  salt: Uint8Array = new Uint8Array(32),
  length = 32
) => {
  const base = await crypto.subtle.importKey("raw", keyMaterial, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: typeof info === "string" ? utf8.encode(info) : info },
    base,
    length * 8
  );
  return new Uint8Array(bits);
};

/** What the browser sends to sign in. The server keeps only a slow hash of it. */
export const deriveAuthKey = (masterKey: Uint8Array) => hkdf(masterKey, "2keevo/auth/v1");

/** Wraps the user key. Never sent anywhere. */
export const deriveWrappingKey = (masterKey: Uint8Array) => hkdf(masterKey, "2keevo/wrap/v1");

// ---------------------------------------------------------------- symmetric encryption

const aesKey = (keyBytes: Uint8Array) => {
  if (keyBytes.length !== 32) throw new E2EError("bad-key");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};

/**
 * AES-256-GCM. `context` binds the ciphertext to where it belongs (for
 * example "item:42:content"), so a server can't swap one item's data into
 * another and have it decrypt.
 */
export const encryptBytes = async (keyBytes: Uint8Array, plain: Uint8Array, context = "") => {
  const iv = randomBytes(12);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode(context) },
    await aesKey(keyBytes),
    plain
  );
  return `e2e1.${toB64url(iv)}.${toB64url(new Uint8Array(sealed))}`;
};

export const decryptBytes = async (keyBytes: Uint8Array, token: string, context = "") => {
  const parts = String(token).split(".");
  if (parts[0] !== "e2e1") {
    throw new E2EError(parts[0]?.startsWith("e2e") ? "unsupported-version" : "bad-format");
  }
  if (parts.length !== 3) throw new E2EError("bad-format");
  const iv = fromB64url(parts[1]);
  if (iv.length !== 12) throw new E2EError("bad-format");
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: utf8.encode(context) },
      await aesKey(keyBytes),
      fromB64url(parts[2])
    );
    return new Uint8Array(plain);
  } catch (error) {
    if (error instanceof E2EError) throw error;
    // Wrong key, wrong context, or the data was changed.
    throw new E2EError("decrypt-failed");
  }
};

export const encryptJson = (keyBytes: Uint8Array, value: unknown, context = "") =>
  encryptBytes(keyBytes, utf8.encode(JSON.stringify(value)), context);

export const decryptJson = async <T = unknown>(keyBytes: Uint8Array, token: string, context = "") =>
  JSON.parse(fromUtf8.decode(await decryptBytes(keyBytes, token, context))) as T;

/** Lock one key with another (user key with the wrapping key, item key with a collection key…). */
export const wrapKey = (wrappingKey: Uint8Array, key: Uint8Array, context: string) =>
  encryptBytes(wrappingKey, key, `key:${context}`);

export const unwrapKey = async (wrappingKey: Uint8Array, token: string, context: string) => {
  const key = await decryptBytes(wrappingKey, token, `key:${context}`);
  // 32 bytes: a symmetric key. 48: an X25519 private key in PKCS#8.
  if (key.length !== 32 && key.length !== 48) throw new E2EError("bad-key");
  return key;
};

// ---------------------------------------------------------------- key pairs (sharing)

const X25519 = { name: "X25519" } as const;
// PKCS#8 wrapper for a raw 32-byte X25519 private key (RFC 8410).
const PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);

export interface KeyPair {
  /** 32 bytes, base64url. Stored readable on the server; anyone may have it. */
  publicKey: string;
  /** PKCS#8 bytes. Only ever stored wrapped with the user key. */
  privateKey: Uint8Array;
}

// Browsers without X25519 in WebCrypto (older Safari and iOS, some WebKit
// builds) use @noble/curves, an audited JavaScript implementation. Both give
// the same results (RFC 7748 vectors in the tests) and the same key formats.
let nativeX25519: Promise<boolean> | null = null;
const hasNativeX25519 = () =>
  (nativeX25519 ??= crypto.subtle
    .generateKey(X25519, false, ["deriveBits"])
    .then(() => true)
    .catch(() => false));

/** For tests: force the JavaScript implementation. */
let forceFallback = false;

const nativeAvailable = async () => !forceFallback && (await hasNativeX25519());

const rawPrivate = (pkcs8: Uint8Array) => {
  if (pkcs8.length !== 48 || PKCS8_PREFIX.some((byte, at) => pkcs8[at] !== byte)) {
    throw new E2EError("bad-key");
  }
  return pkcs8.subarray(16);
};

export const generateKeyPair = async (): Promise<KeyPair> => {
  if (!(await nativeAvailable())) {
    const raw = x25519.utils.randomPrivateKey();
    return { publicKey: toB64url(x25519.getPublicKey(raw)), privateKey: privateKeyFromRaw(raw) };
  }
  const pair = (await crypto.subtle.generateKey(X25519, true, ["deriveBits"])) as CryptoKeyPair;
  return {
    publicKey: toB64url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
    privateKey: new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)),
  };
};

/** PKCS#8 bytes from a raw 32-byte private key (for test vectors and older exports). */
export const privateKeyFromRaw = (raw: Uint8Array) => {
  if (raw.length !== 32) throw new E2EError("bad-key");
  return concat(PKCS8_PREFIX, raw);
};

const importPublic = (raw: Uint8Array) => {
  if (raw.length !== 32) throw new E2EError("bad-key");
  return crypto.subtle.importKey("raw", raw, X25519, false, []);
};

const importPrivate = (pkcs8: Uint8Array) =>
  crypto.subtle.importKey("pkcs8", pkcs8, X25519, false, ["deriveBits"]).catch(() => {
    throw new E2EError("bad-key");
  });

/**
 * Raw X25519 shared secret (exported for test vectors). A degenerate public
 * key makes some engines throw and others return zeros: both are "bad-key".
 */
export const sharedSecret = async (privateKey: Uint8Array, publicKey: Uint8Array) => {
  if (!(await nativeAvailable())) {
    if (publicKey.length !== 32) throw new E2EError("bad-key");
    try {
      return x25519.getSharedSecret(rawPrivate(privateKey), publicKey);
    } catch {
      throw new E2EError("bad-key");
    }
  }
  const publicCryptoKey = await importPublic(publicKey);
  const privateCryptoKey = await importPrivate(privateKey);
  try {
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: "X25519", public: publicCryptoKey }, privateCryptoKey, 256)
    );
  } catch {
    throw new E2EError("bad-key");
  }
};

const sealKey = async (secret: Uint8Array, ephemeral: Uint8Array, recipient: Uint8Array) => {
  // An all-zero secret means a degenerate public key: refuse it.
  if (secret.every((byte) => byte === 0)) throw new E2EError("bad-key");
  return hkdf(secret, "2keevo/seal/v1", concat(ephemeral, recipient));
};

/**
 * Lock bytes (usually a key) so only the owner of `recipientPublicKey` can
 * open them: a fresh ephemeral key pair, X25519, HKDF, AES-256-GCM.
 */
export const sealTo = async (recipientPublicKey: string, plain: Uint8Array, context = "") => {
  const recipient = fromB64url(recipientPublicKey);
  const ephemeral = await generateKeyPair();
  const ephemeralRaw = fromB64url(ephemeral.publicKey);
  const key = await sealKey(await sharedSecret(ephemeral.privateKey, recipient), ephemeralRaw, recipient);
  const inner = await encryptBytes(key, plain, `seal:${context}`);
  return `e2e1x.${ephemeral.publicKey}.${inner.slice("e2e1.".length)}`;
};

export const openSealed = async (
  privateKey: Uint8Array,
  ownPublicKey: string,
  token: string,
  context = ""
) => {
  const parts = String(token).split(".");
  if (parts[0] !== "e2e1x") {
    throw new E2EError(parts[0]?.startsWith("e2e") ? "unsupported-version" : "bad-format");
  }
  if (parts.length !== 4) throw new E2EError("bad-format");
  const ephemeral = fromB64url(parts[1]);
  const key = await sealKey(
    await sharedSecret(privateKey, ephemeral),
    ephemeral,
    fromB64url(ownPublicKey)
  );
  return decryptBytes(key, `e2e1.${parts[2]}.${parts[3]}`, `seal:${context}`);
};

/**
 * A short code for comparing a public key in person or by phone
 * ("key fingerprint"): SHA-256 of the key, 20 characters in groups of 4.
 */
export const fingerprint = async (publicKey: string) => {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", concat(utf8.encode("2keevo/fingerprint/v1"), fromB64url(publicKey)))
  );
  return base32(digest.subarray(0, 13)).slice(0, 20).match(/.{4}/g)!.join("-");
};

// ---------------------------------------------------------------- recovery key

// Crockford base32: no I, L, O, U, so it's easy to read aloud and type.
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const base32 = (bytes: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += RECOVERY_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += RECOVERY_ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

const RECOVERY_LENGTH = 32; // 32 characters × 5 bits = 160 bits

/** A printable recovery key: 8 groups of 4, e.g. "7KQ2-…". 160 random bits. */
export const newRecoveryKey = () =>
  base32(randomBytes(20)).slice(0, RECOVERY_LENGTH).match(/.{4}/g)!.join("-");

/** Tidies what a person typed: case, spaces, dashes, and look-alike letters. */
export const normalizeRecoveryKey = (typed: string) => {
  const clean = typed
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (clean.length !== RECOVERY_LENGTH || [...clean].some((char) => !RECOVERY_ALPHABET.includes(char))) {
    throw new E2EError("bad-key");
  }
  return clean;
};

/** The key a recovery key unlocks with. It's already random, so no slow hashing is needed. */
export const deriveRecoveryWrappingKey = (recoveryKey: string) =>
  hkdf(utf8.encode(normalizeRecoveryKey(recoveryKey)), "2keevo/recovery/v1");

/**
 * Proves to the server that someone holds the recovery key, without revealing
 * it or the wrapping key (different HKDF label).
 */
export const deriveRecoveryAuthKey = (recoveryKey: string) =>
  hkdf(utf8.encode(normalizeRecoveryKey(recoveryKey)), "2keevo/recovery-auth/v1");

// ---------------------------------------------------------------- passkey unlock (stage 10.2b)

/**
 * What a passkey's PRF output is used for: the salt the browser asks the
 * passkey to evaluate (the same for every passkey; each passkey's secret is
 * its own), and the wrapping key made from the secret it returns.
 */
export const PASSKEY_PRF_SALT = utf8.encode("2keevo/passkey-prf-salt/v1".padEnd(32, "."));

export const derivePasskeyWrappingKey = (prfOutput: Uint8Array) => {
  if (prfOutput.length < 32) throw new E2EError("bad-key");
  return hkdf(prfOutput, "2keevo/passkey-unlock/v1");
};

// ---------------------------------------------------------------- for tests only

/** Raw building blocks with fixed inputs, for known-answer tests. Not for app code. */
export const testing = {
  hkdf,
  /** Run the sharing functions on the JavaScript X25519, as on older Safari. */
  useJsX25519: (on: boolean) => {
    forceFallback = on;
  },
  aesGcm: async (keyBytes: Uint8Array, iv: Uint8Array, plain: Uint8Array, aad: Uint8Array) =>
    new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, await aesKey(keyBytes), plain)
    ),
  base32,
};
