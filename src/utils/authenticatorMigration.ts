// Google Authenticator's "Transfer accounts" QR codes:
// otpauth-migration://offline?data=<base64 of a protobuf MigrationPayload>.
// A reader for just this one message, so no protobuf library is needed.
//
// message MigrationPayload {
//   repeated OtpParameters otp_parameters = 1;
//   int32 version = 2; int32 batch_size = 3; int32 batch_index = 4; int32 batch_id = 5;
// }
// message OtpParameters {
//   bytes secret = 1; string name = 2; string issuer = 3;
//   Algorithm algorithm = 4;   // 1 SHA1, 2 SHA256, 3 SHA512, 4 MD5
//   DigitCount digits = 5;     // 1 six, 2 eight
//   OtpType type = 6;          // 1 HOTP, 2 TOTP
//   int64 counter = 7;
// }

export interface MigratedAccount {
  issuer: string;
  name: string;
  /** otpauth://totp/ link for the Authenticator key field; empty when it can't be used. */
  uri: string;
  /** Why the account can't be imported, when it can't. */
  problem: string;
}

export interface MigrationBatch {
  accounts: MigratedAccount[];
  batchId: number;
  batchIndex: number;
  batchSize: number;
}

export const isMigrationLink = (text: string) => /^otpauth-migration:\/\//i.test(text.trim());

class Reader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}

  get done() {
    return this.at >= this.bytes.length;
  }

  varint() {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (this.at >= this.bytes.length) throw new Error("cut short");
      const byte = this.bytes[this.at++];
      // Numbers here (lengths, enums, counters) stay well inside 2^53.
      result += (byte & 0x7f) * 2 ** shift;
      if (!(byte & 0x80)) return result;
      shift += 7;
      if (shift > 63) throw new Error("bad number");
    }
  }

  chunk() {
    const length = this.varint();
    if (this.at + length > this.bytes.length) throw new Error("cut short");
    const value = this.bytes.subarray(this.at, this.at + length);
    this.at += length;
    return value;
  }

  skip(wireType: number) {
    if (wireType === 0) this.varint();
    else if (wireType === 1) this.at += 8;
    else if (wireType === 2) this.chunk();
    else if (wireType === 5) this.at += 4;
    else throw new Error("unknown field type");
  }
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const base32 = (bytes: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
};

const ALGORITHMS: Record<number, string> = { 0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512" };

const readAccount = (bytes: Uint8Array): MigratedAccount => {
  const reader = new Reader(bytes);
  let secret = new Uint8Array();
  let name = "";
  let issuer = "";
  let algorithm = 0;
  let digits = 0;
  let type = 0;
  while (!reader.done) {
    const key = reader.varint();
    const field = Math.floor(key / 8);
    const wire = key & 7;
    if (field === 1 && wire === 2) secret = reader.chunk();
    else if (field === 2 && wire === 2) name = text(reader.chunk());
    else if (field === 3 && wire === 2) issuer = text(reader.chunk());
    else if (field === 4 && wire === 0) algorithm = reader.varint();
    else if (field === 5 && wire === 0) digits = reader.varint();
    else if (field === 6 && wire === 0) type = reader.varint();
    else reader.skip(wire);
  }

  // Names often carry the issuer too: "GitHub:alice".
  if (!issuer && name.includes(":")) [issuer, name] = name.split(/:(.*)/s);
  else if (issuer && name.startsWith(`${issuer}:`)) name = name.slice(issuer.length + 1);
  issuer = issuer.trim();
  name = name.trim();

  let problem = "";
  if (type === 1) problem = "Counter-based codes (HOTP) are not supported";
  else if (algorithm === 4) problem = "MD5 codes are not supported";
  else if (secret.length < 10) problem = "The key is missing or too short";

  let uri = "";
  if (!problem) {
    const label = issuer ? `${issuer}:${name}` : name || "Account";
    const params = new URLSearchParams({ secret: base32(secret) });
    if (issuer) params.set("issuer", issuer);
    if (ALGORITHMS[algorithm] !== "SHA1") params.set("algorithm", ALGORITHMS[algorithm]);
    if (digits === 2) params.set("digits", "8");
    uri = `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }
  return { issuer, name, uri, problem };
};

// Reads one transfer QR code. Throws with a message people can act on.
export const parseMigrationLink = (link: string): MigrationBatch => {
  const match = link.trim().match(/[?&]data=([^&#]+)/i);
  if (!isMigrationLink(link) || !match) {
    throw new Error("That is not a Google Authenticator transfer code.");
  }
  let bytes: Uint8Array;
  try {
    const base64 = decodeURIComponent(match[1]).replace(/-/g, "+").replace(/_/g, "/").replace(/ /g, "+");
    bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    throw new Error("That transfer code is damaged. Try another screenshot.");
  }

  try {
    const reader = new Reader(bytes);
    const batch: MigrationBatch = { accounts: [], batchId: 0, batchIndex: 0, batchSize: 1 };
    while (!reader.done) {
      const key = reader.varint();
      const field = Math.floor(key / 8);
      const wire = key & 7;
      if (field === 1 && wire === 2) batch.accounts.push(readAccount(reader.chunk()));
      else if (field === 3 && wire === 0) batch.batchSize = reader.varint() || 1;
      else if (field === 4 && wire === 0) batch.batchIndex = reader.varint();
      else if (field === 5 && wire === 0) batch.batchId = reader.varint();
      else reader.skip(wire);
    }
    return batch;
  } catch {
    throw new Error("That transfer code is damaged. Try another screenshot.");
  }
};
