// Encrypted file attachments (plans/vault-features.md, phase C).
//
// Each file gets its own random key, wrapped with the item's key, so anyone who can open
// the item can open its files. The file is encrypted in 1 MiB chunks with AES-256-GCM;
// each chunk is bound to the attachment, its position and whether it's the last one, so
// the server can't swap, reorder, drop or cut off chunks without decryption failing.
//
// Stored format: for each chunk, a 12-byte IV followed by the ciphertext and its 16-byte tag.
// Every chunk but the last holds exactly CHUNK bytes of the file. An empty file is one empty chunk.
import { decryptJson, E2EError, encryptJson, newSymmetricKey, randomBytes, unwrapKey, wrapKey } from "./e2e";

export const CHUNK = 1024 * 1024;
const IV = 12;
const TAG = 16;
const encoder = new TextEncoder();

/** A file's name and type, encrypted with its key. */
export interface AttachmentMeta {
  name: string;
  type: string;
  size: number;
}

const keyContext = (e2eId: string, attachmentId: string) => `attachment-key:${e2eId}:${attachmentId}`;
const metaContext = (attachmentId: string) => `attachment-meta:${attachmentId}`;
const chunkData = (attachmentId: string, index: number, last: boolean) =>
  encoder.encode(`attachment-chunk:${attachmentId}:${index}:${last ? 1 : 0}`);

const chunkCount = (size: number) => Math.max(1, Math.ceil(size / CHUNK));

/** How big a file of this size is once encrypted (the upload is reserved with this). */
export const encryptedSize = (size: number) => size + chunkCount(size) * (IV + TAG);

const aesKey = (key: Uint8Array) => crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);

/** Encrypt a file for an item. `attachmentId` comes from the server's reservation. */
export const encryptFile = async (itemKey: Uint8Array, e2eId: string, attachmentId: string, file: Blob, name: string) => {
  const fileKey = newSymmetricKey();
  const key = await aesKey(fileKey);
  const count = chunkCount(file.size);
  const parts: BlobPart[] = [];
  for (let index = 0; index < count; index += 1) {
    const plain = new Uint8Array(await file.slice(index * CHUNK, (index + 1) * CHUNK).arrayBuffer());
    const iv = randomBytes(IV);
    const sealed = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: chunkData(attachmentId, index, index === count - 1) },
      key,
      plain
    );
    parts.push(iv, new Uint8Array(sealed));
  }
  const meta: AttachmentMeta = { name: name.slice(0, 255), type: (file.type || "application/octet-stream").slice(0, 100), size: file.size };
  return {
    body: new Blob(parts, { type: "application/octet-stream" }),
    wrappedKey: await wrapKey(itemKey, fileKey, keyContext(e2eId, attachmentId)),
    encMeta: await encryptJson(fileKey, meta, metaContext(attachmentId)),
  };
};

const openFileKey = (itemKey: Uint8Array, e2eId: string, attachmentId: string, wrappedKey: string) =>
  unwrapKey(itemKey, wrappedKey, keyContext(e2eId, attachmentId));

/** A file's name, type and size, without downloading it. */
export const openMeta = async (itemKey: Uint8Array, e2eId: string, attachmentId: string, wrappedKey: string, encMeta: string) =>
  decryptJson<AttachmentMeta>(await openFileKey(itemKey, e2eId, attachmentId, wrappedKey), encMeta, metaContext(attachmentId));

/** Decrypt a downloaded file. Throws if any chunk was changed, moved or left out. */
export const decryptFile = async (
  itemKey: Uint8Array,
  e2eId: string,
  attachmentId: string,
  wrappedKey: string,
  data: ArrayBuffer,
  type = "application/octet-stream"
) => {
  const key = await aesKey(await openFileKey(itemKey, e2eId, attachmentId, wrappedKey));
  const bytes = new Uint8Array(data);
  const full = CHUNK + IV + TAG;
  const count = Math.max(1, Math.ceil(bytes.length / full));
  // Every chunk but the last is full; the last holds at least its IV and tag.
  const lastLength = bytes.length - (count - 1) * full;
  if (lastLength < IV + TAG) throw new E2EError("bad-format");
  const parts: BlobPart[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * full;
    const chunk = bytes.subarray(start, Math.min(start + full, bytes.length));
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: chunk.subarray(0, IV), additionalData: chunkData(attachmentId, index, index === count - 1) },
        key,
        chunk.subarray(IV)
      );
      parts.push(new Uint8Array(plain));
    } catch {
      throw new E2EError("decrypt-failed");
    }
  }
  return new Blob(parts, { type });
};
