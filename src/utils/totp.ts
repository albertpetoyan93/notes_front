// Authenticator (TOTP, RFC 6238) codes for the sites saved in the vault.
// The key stays in the item; codes are made here, in the browser, and never stored.

// Field names that hold an authenticator key. None contain "pass", so a key is
// never taken for a password. Same rule as the API (NoteService.ts).
const TOTP_LABEL =
  /^(2fa|mfa|totp|otp|authenticator|two[- ]?factor)( (key|secret|code|seed|uri|url|link))?$/i;

export const TOTP_FIELD_LABEL = "Authenticator key";

export const isTotpLabel = (label?: string) => TOTP_LABEL.test(String(label || "").trim());

export interface TotpConfig {
  secret: Uint8Array;
  digits: number;
  period: number;
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
  issuer: string;
  account: string;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (input: string): Uint8Array | null => {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
};

const ALGORITHMS: Record<string, TotpConfig["algorithm"]> = {
  SHA1: "SHA-1",
  SHA256: "SHA-256",
  SHA512: "SHA-512",
};

const parseUri = (raw: string): TotpConfig | null => {
  if (!/^otpauth:\/\/totp\//i.test(raw)) return null;
  const param = (name: string) => {
    const match = raw.match(new RegExp(`[?&]${name}=([^&#]*)`, "i"));
    try {
      return match ? decodeURIComponent(match[1]) : "";
    } catch {
      return match?.[1] || "";
    }
  };
  const secret = base32Decode(param("secret"));
  if (!secret || secret.length < 10) return null;
  const algorithm = ALGORITHMS[param("algorithm").toUpperCase() || "SHA1"];
  if (!algorithm) return null;
  const digits = Number(param("digits") || 6);
  const period = Number(param("period") || 30);
  if (![6, 7, 8].includes(digits) || !(period >= 10 && period <= 300)) return null;

  let label = (raw.match(/^otpauth:\/\/totp\/([^?#]*)/i) || [])[1] || "";
  try {
    label = decodeURIComponent(label);
  } catch {
    /* Keep it as written. */
  }
  const [labelIssuer, labelAccount] = label.includes(":")
    ? label.split(/:(.*)/s)
    : ["", label];
  return {
    secret,
    digits,
    period,
    algorithm,
    issuer: param("issuer") || labelIssuer.trim(),
    account: (labelAccount || "").trim(),
  };
};

// A text key ("JBSW Y3DP EHPK 3PXP") or an otpauth://totp/ link, or null.
export const parseTotp = (value?: string): TotpConfig | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^otpauth:/i.test(raw)) return parseUri(raw);
  const clean = raw.replace(/[\s=-]/g, "");
  // Shorter strings are more likely a note ("SMS") than a key.
  if (clean.length < 16) return null;
  const secret = base32Decode(clean);
  if (!secret) return null;
  return { secret, digits: 6, period: 30, algorithm: "SHA-1", issuer: "", account: "" };
};

const keyCache = new WeakMap<Uint8Array, Map<string, Promise<CryptoKey>>>();

const hmacKey = (config: TotpConfig) => {
  let byAlgorithm = keyCache.get(config.secret);
  if (!byAlgorithm) {
    byAlgorithm = new Map();
    keyCache.set(config.secret, byAlgorithm);
  }
  let key = byAlgorithm.get(config.algorithm);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      config.secret,
      { name: "HMAC", hash: config.algorithm },
      false,
      ["sign"]
    );
    byAlgorithm.set(config.algorithm, key);
  }
  return key;
};

export const totpStep = (config: TotpConfig, now = Date.now()) =>
  Math.floor(now / 1000 / config.period);

export const secondsLeft = (config: TotpConfig, now = Date.now()) =>
  config.period - ((now / 1000) % config.period);

export const totpCode = async (config: TotpConfig, step = totpStep(config)) => {
  const counter = new Uint8Array(8);
  let rest = step;
  for (let index = 7; index >= 0; index -= 1) {
    counter[index] = rest & 255;
    rest = Math.floor(rest / 256);
  }
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(config), counter));
  const offset = mac[mac.length - 1] & 15;
  const number =
    ((mac[offset] & 127) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(number % 10 ** config.digits).padStart(config.digits, "0");
};

// "482913" → "482 913", the way authenticator apps show it.
export const groupCode = (code: string) => {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
};

// The text inside a QR code in a screenshot or photo.
export const readQrImage = async (file: Blob): Promise<string> => {
  const { default: jsQR } = await import("jsqr");
  const bitmap = await createImageBitmap(file);
  // Large photos are scaled down; QR codes stay readable and decoding stays fast.
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot read images.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const pixels = context.getImageData(0, 0, width, height);
  const result = jsQR(pixels.data, width, height, { inversionAttempts: "attemptBoth" });
  if (!result?.data) throw new Error("No QR code found in that image.");
  return result.data.trim();
};

// Reads the otpauth:// link from a screenshot or photo of the site's QR code.
export const readTotpQr = async (file: Blob): Promise<string> => {
  const text = await readQrImage(file);
  if (/^otpauth-migration:/i.test(text)) {
    throw new Error(
      "This is a Google Authenticator transfer code. Use Import → Google Authenticator to add all its accounts."
    );
  }
  if (!parseTotp(text)) {
    throw new Error("That QR code is not an authenticator code (otpauth://totp/…).");
  }
  return text;
};
