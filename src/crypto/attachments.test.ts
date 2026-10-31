import { describe, expect, it } from "vitest";
import { CHUNK, decryptFile, encryptedSize, encryptFile, openMeta } from "./attachments";
import { newSymmetricKey } from "./e2e";

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const sample = (size: number) => {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) data[i] = (i * 31 + 7) % 251;
  return data;
};

describe("file attachments", () => {
  it("round trip for an empty file, a small one and one over several chunks", async () => {
    const itemKey = newSymmetricKey();
    for (const size of [0, 5, CHUNK, CHUNK * 2 + 17]) {
      const plain = sample(size);
      const sealed = await encryptFile(itemKey, "item1", "att1", new Blob([plain], { type: "application/pdf" }), "scan.pdf");
      expect(sealed.body.size).toBe(encryptedSize(size));
      const meta = await openMeta(itemKey, "item1", "att1", sealed.wrappedKey, sealed.encMeta);
      expect(meta).toEqual({ name: "scan.pdf", type: "application/pdf", size });
      const opened = await decryptFile(itemKey, "item1", "att1", sealed.wrappedKey, await sealed.body.arrayBuffer());
      expect(Buffer.from(await bytesOf(opened)).equals(Buffer.from(plain))).toBe(true);
    }
  });

  it("refuses another item's key, another attachment id, and changed, cut or reordered data", async () => {
    const itemKey = newSymmetricKey();
    const plain = sample(CHUNK * 2 + 100);
    const sealed = await encryptFile(itemKey, "item1", "att1", new Blob([plain]), "a.bin");
    const data = await bytesOf(sealed.body);

    await expect(decryptFile(newSymmetricKey(), "item1", "att1", sealed.wrappedKey, data.buffer)).rejects.toThrow();
    await expect(decryptFile(itemKey, "item2", "att1", sealed.wrappedKey, data.buffer)).rejects.toThrow();
    await expect(decryptFile(itemKey, "item1", "att2", sealed.wrappedKey, data.buffer)).rejects.toThrow();

    const changed = data.slice();
    changed[CHUNK + 40] ^= 1;
    await expect(decryptFile(itemKey, "item1", "att1", sealed.wrappedKey, changed.buffer)).rejects.toThrow();

    // Cut off after whole chunks: the new last chunk wasn't sealed as the last one.
    const full = CHUNK + 28;
    await expect(decryptFile(itemKey, "item1", "att1", sealed.wrappedKey, data.slice(0, full * 2).buffer)).rejects.toThrow();

    const swapped = new Uint8Array(data.length);
    swapped.set(data.subarray(full, full * 2), 0);
    swapped.set(data.subarray(0, full), full);
    swapped.set(data.subarray(full * 2), full * 2);
    await expect(decryptFile(itemKey, "item1", "att1", sealed.wrappedKey, swapped.buffer)).rejects.toThrow();
  });
});
