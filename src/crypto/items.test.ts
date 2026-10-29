import { describe, expect, it } from "vitest";
import { E2EError, generateKeyPair, newSymmetricKey } from "./e2e";
import {
  describeChanges,
  newCollectionKey,
  openCollectionKey,
  openFromCollection,
  openSharedItemKey,
  sealCollectionKey,
  shareItemKey,
  wrapForCollection,
  openItemData,
  openItemKey,
  openVersion,
  sealItemData,
  sealNewItem,
  sealVersion,
  type ItemPayload,
} from "./items";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

const payload: ItemPayload = {
  title: "GitHub",
  category: "password",
  tags: ["work"],
  comment: "",
  content: { mainContent: "", customFields: [{ label: "Password", value: "hunter2-but-longer" }] },
};

describe("end-to-end items", () => {
  it("seals and opens an item with only the user key and what the server stores", async () => {
    const userKey = newSymmetricKey();
    const { sealed } = await sealNewItem(userKey, payload);
    expect(sealed.e2eId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // The server's copy shows nothing of the item.
    expect(JSON.stringify(sealed)).not.toMatch(/GitHub|hunter2|work/);
    const key = await openItemKey(userKey, sealed.e2eId, sealed.itemKey);
    expect(await openItemData(key, sealed.e2eId, sealed.encData)).toEqual(payload);
  });

  it("refuses another person's user key", async () => {
    const { sealed } = await sealNewItem(newSymmetricKey(), payload);
    await expect(openItemKey(newSymmetricKey(), sealed.e2eId, sealed.itemKey)).rejects.toBeInstanceOf(E2EError);
  });

  it("refuses data or keys moved from another item", async () => {
    const userKey = newSymmetricKey();
    const a = await sealNewItem(userKey, payload);
    const b = await sealNewItem(userKey, { ...payload, title: "Bank" });
    // B's key and data under A's id: both are bound to their own item.
    await expect(openItemKey(userKey, a.sealed.e2eId, b.sealed.itemKey)).rejects.toBeInstanceOf(E2EError);
    await expect(openItemData(a.key, a.sealed.e2eId, b.sealed.encData)).rejects.toBeInstanceOf(E2EError);
    // An item's version can't be passed off as its current data, or the reverse.
    const version = await sealVersion(a.key, a.sealed.e2eId, { ...payload, changes: ["Created"] });
    await expect(openItemData(a.key, a.sealed.e2eId, version)).rejects.toBeInstanceOf(E2EError);
    await expect(openVersion(a.key, a.sealed.e2eId, a.sealed.encData)).rejects.toBeInstanceOf(E2EError);
  });

  it("keeps the item key when saving changes", async () => {
    const userKey = newSymmetricKey();
    const { sealed, key } = await sealNewItem(userKey, payload);
    const edited = { ...payload, title: "GitHub (work)" };
    const encData = await sealItemData(key, sealed.e2eId, edited);
    const reopened = await openItemKey(userKey, sealed.e2eId, sealed.itemKey);
    expect(await openItemData(reopened, sealed.e2eId, encData)).toEqual(edited);
  });

  it("shares an item key with one person, and only them", async () => {
    const ana = await generateKeyPair();
    const eve = await generateKeyPair();
    const { sealed, key } = await sealNewItem(newSymmetricKey(), payload);
    const token = await shareItemKey(ana.publicKey, sealed.e2eId, key);
    expect(hex(await openSharedItemKey(ana.privateKey, ana.publicKey, sealed.e2eId, token))).toBe(hex(key));
    await expect(openSharedItemKey(eve.privateKey, eve.publicKey, sealed.e2eId, token)).rejects.toBeInstanceOf(E2EError);
    // Bound to its item: it can't be passed off as another item's key.
    const other = await sealNewItem(newSymmetricKey(), payload);
    await expect(openSharedItemKey(ana.privateKey, ana.publicKey, other.sealed.e2eId, token)).rejects.toBeInstanceOf(E2EError);
  });

  it("opens an item through a collection key sealed to each member", async () => {
    const ana = await generateKeyPair();
    const collectionKey = newCollectionKey();
    const forAna = await sealCollectionKey(ana.publicKey, 7, 1, collectionKey);
    const { sealed, key } = await sealNewItem(newSymmetricKey(), payload);
    const wrapped = await wrapForCollection(collectionKey, 7, sealed.e2eId, key);

    const opened = await openCollectionKey(ana.privateKey, ana.publicKey, 7, 1, forAna);
    expect(hex(await openFromCollection(opened, 7, sealed.e2eId, wrapped))).toBe(hex(key));
    // A copy for one collection or key version doesn't open another.
    await expect(openCollectionKey(ana.privateKey, ana.publicKey, 7, 2, forAna)).rejects.toBeInstanceOf(E2EError);
    await expect(openFromCollection(opened, 8, sealed.e2eId, wrapped)).rejects.toBeInstanceOf(E2EError);
    // After a new key replaces it, the old one opens nothing new.
    const next = newCollectionKey();
    const rewrapped = await wrapForCollection(next, 7, sealed.e2eId, key);
    await expect(openFromCollection(collectionKey, 7, sealed.e2eId, rewrapped)).rejects.toBeInstanceOf(E2EError);
  });

  it("names what changed, never the values", () => {
    const after = {
      ...payload,
      title: "GitHub 2",
      content: { mainContent: "", customFields: [{ label: "Password", value: "new" }] },
    };
    expect(describeChanges(payload, after)).toEqual(["Name", "Password"]);
    expect(describeChanges(payload, payload)).toEqual([]);
  });
});
