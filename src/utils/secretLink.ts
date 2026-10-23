// One-time secret links, encrypted in the browser. The key is random and
// lives only in the link after "#", which browsers never send to a server.
// With a passphrase, a key derived from it (PBKDF2, 600k rounds) is mixed in,
// so the link alone isn't enough.

export interface SecretPayload {
  v: 1;
  title?: string;
  fields: { label: string; value: string }[];
  text?: string;
}

export interface SealedSecret {
  ciphertext: string;
  iv: string;
  salt?: string;
  check?: string;
}

export const MAX_SECRET_BYTES = 50 * 1024;
const PBKDF2_ROUNDS = 600_000;
const CHECK_TEXT = "2keevo secret link";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const toB64url = (bytes: Uint8Array) => {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromB64url = (text: string) => {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const random = (length: number) => crypto.getRandomValues(new Uint8Array(length));

const aesKey = async (linkKey: Uint8Array, passphrase?: string, salt?: Uint8Array) => {
  let material = linkKey;
  if (passphrase) {
    const base = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt!, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
      base,
      256
    );
    material = new Uint8Array([...linkKey, ...new Uint8Array(bits)]);
  }
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const seal = async (key: CryptoKey, bytes: Uint8Array) => {
  const iv = random(12);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  return { iv: toB64url(iv), ciphertext: toB64url(ciphertext) };
};

/** Encrypts a secret. Returns what the server stores, and the key for the link. */
export const sealSecret = async (payload: SecretPayload, passphrase?: string) => {
  const bytes = encoder.encode(JSON.stringify(payload));
  if (bytes.length > MAX_SECRET_BYTES) {
    throw new Error("That is too much for one link (50 KB at most).");
  }
  const linkKey = random(32);
  const salt = passphrase ? random(16) : undefined;
  const key = await aesKey(linkKey, passphrase, salt);
  const body: SealedSecret = await seal(key, bytes);
  if (salt) {
    const check = await seal(key, encoder.encode(CHECK_TEXT));
    body.salt = toB64url(salt);
    body.check = `${check.iv}.${check.ciphertext}`;
  }
  return { body, fragment: toB64url(linkKey) };
};

/** Tests a passphrase without opening the link (no view is used). */
export const passphraseMatches = async (
  fragment: string,
  passphrase: string,
  salt: string,
  check: string
) => {
  try {
    const key = await aesKey(fromB64url(fragment), passphrase, fromB64url(salt));
    const [iv, ciphertext] = check.split(".");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64url(iv) },
      key,
      fromB64url(ciphertext)
    );
    return decoder.decode(plain) === CHECK_TEXT;
  } catch {
    return false;
  }
};

export const unsealSecret = async (
  sealed: { ciphertext: string; iv: string },
  fragment: string,
  passphrase?: string,
  salt?: string
): Promise<SecretPayload> => {
  const key = await aesKey(fromB64url(fragment), passphrase, salt ? fromB64url(salt) : undefined);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(sealed.iv) },
    key,
    fromB64url(sealed.ciphertext)
  );
  return JSON.parse(decoder.decode(plain));
};

export const secretLinkUrl = (id: string, fragment: string) =>
  `${window.location.origin}/s/${id}#${fragment}`;

export const EXPIRY_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 24, label: "1 day" },
  { value: 168, label: "7 days" },
];

export const VIEW_OPTIONS = [1, 2, 3, 5, 10];
