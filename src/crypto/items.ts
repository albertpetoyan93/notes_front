// Items encrypted in the browser (E2E_DESIGN.md, stage 10.3).
//
// Each item has its own random key. The server stores that key wrapped with
// the owner's user key ("itemKey"), and the item's title, notes, fields and
// tags encrypted with it ("encData"). Both are bound to a random id ("e2eId"),
// so the server can't swap one item's data or versions into another.
import {
  decryptJson,
  E2EError,
  encryptJson,
  newSymmetricKey,
  openSealed,
  randomBytes,
  sealTo,
  toB64url,
  unwrapKey,
  wrapKey,
} from "./e2e";

/** What an item's encrypted data holds. Category is also kept readable. */
export interface ItemPayload {
  title: string;
  content: unknown;
  comment?: string;
  project?: string | null;
  tags: string[];
  category: string;
}

/** A saved state in an item's history, and what changed (names only). */
export interface VersionPayload {
  title: string;
  content: unknown;
  tags: string[];
  category: string;
  changes: string[];
}

export interface SealedItem {
  e2eId: string;
  itemKey: string;
  encData: string;
}

const keyContext = (e2eId: string) => `item:${e2eId}`;
const dataContext = (e2eId: string) => `item-data:${e2eId}`;
const versionContext = (e2eId: string) => `item-version:${e2eId}`;

/** A new item: a fresh key and id, and its data sealed with them. */
export const sealNewItem = async (userKey: Uint8Array, payload: ItemPayload) => {
  const e2eId = toB64url(randomBytes(16));
  const key = newSymmetricKey();
  const sealed: SealedItem = {
    e2eId,
    itemKey: await wrapKey(userKey, key, keyContext(e2eId)),
    encData: await encryptJson(key, payload, dataContext(e2eId)),
  };
  return { sealed, key };
};

export const openItemKey = (userKey: Uint8Array, e2eId: string, itemKey: string) =>
  unwrapKey(userKey, itemKey, keyContext(e2eId));

export const sealItemData = (key: Uint8Array, e2eId: string, payload: ItemPayload) =>
  encryptJson(key, payload, dataContext(e2eId));

export const openItemData = (key: Uint8Array, e2eId: string, encData: string) =>
  decryptJson<ItemPayload>(key, encData, dataContext(e2eId));

// ---------------------------------------------------------------- sharing (stage 10.4)

const shareContext = (e2eId: string) => `item-share:${e2eId}`;
const collectionKeyContext = (collectionId: number, keyVersion: number) => `collection-key:${collectionId}:${keyVersion}`;
const collectionItemContext = (collectionId: number, e2eId: string) => `collection-item:${collectionId}:${e2eId}`;

const assertKey = (key: Uint8Array) => {
  if (key.length !== 32) throw new E2EError("bad-key");
  return key;
};

/** An item key for one person, sealed to their public key (a direct share). */
export const shareItemKey = (publicKey: string, e2eId: string, key: Uint8Array) =>
  sealTo(publicKey, key, shareContext(e2eId));

export const openSharedItemKey = async (privateKey: Uint8Array, ownPublicKey: string, e2eId: string, token: string) =>
  assertKey(await openSealed(privateKey, ownPublicKey, token, shareContext(e2eId)));

/** A collection key for one person, sealed to their public key. */
export const sealCollectionKey = (publicKey: string, collectionId: number, keyVersion: number, key: Uint8Array) =>
  sealTo(publicKey, key, collectionKeyContext(collectionId, keyVersion));

export const openCollectionKey = async (
  privateKey: Uint8Array,
  ownPublicKey: string,
  collectionId: number,
  keyVersion: number,
  token: string
) => assertKey(await openSealed(privateKey, ownPublicKey, token, collectionKeyContext(collectionId, keyVersion)));

/** An item key wrapped with a collection key: everyone holding that collection key can open the item. */
export const wrapForCollection = (collectionKey: Uint8Array, collectionId: number, e2eId: string, key: Uint8Array) =>
  wrapKey(collectionKey, key, collectionItemContext(collectionId, e2eId));

export const openFromCollection = async (collectionKey: Uint8Array, collectionId: number, e2eId: string, token: string) =>
  assertKey(await unwrapKey(collectionKey, token, collectionItemContext(collectionId, e2eId)));

export const newCollectionKey = () => newSymmetricKey();

/**
 * A collection's name, encrypted. `nameKey` says with what: "user" (the
 * owner's user key, for a collection only they see; it has no id yet when
 * made) or "v<N>" (that collection key version, bound to the collection).
 */
const nameContext = (collectionId: number, nameKey: string) =>
  nameKey === "user" ? "collection-name:user" : `collection-name:${collectionId}:${nameKey}`;

export const sealCollectionName = (key: Uint8Array, collectionId: number, nameKey: string, name: string) =>
  encryptJson(key, { name }, nameContext(collectionId, nameKey));

export const openCollectionName = async (key: Uint8Array, collectionId: number, nameKey: string, encName: string) =>
  String((await decryptJson<{ name: string }>(key, encName, nameContext(collectionId, nameKey))).name || "");

export const sealVersion = (key: Uint8Array, e2eId: string, version: VersionPayload) =>
  encryptJson(key, version, versionContext(e2eId));

export const openVersion = (key: Uint8Array, e2eId: string, encData: string) =>
  decryptJson<VersionPayload>(key, encData, versionContext(e2eId));

/**
 * Content to save when an item is edited: saved passkeys (with their private
 * keys) stay unless the new content lists which to keep, by credential id.
 * Same rule as the server's for readable items (util/passkeyContent mergeOnUpdate).
 */
export const mergePasskeys = (existing: any, incoming: any) => {
  if (!incoming || typeof incoming !== "object") return incoming;
  const stored: any[] = Array.isArray(existing?.passkeys) ? existing.passkeys.filter((item: any) => item?.credentialId) : [];
  const next = { ...incoming };
  if (!stored.length) {
    delete next.passkeys;
    return next;
  }
  if (!Array.isArray(incoming.passkeys)) {
    next.passkeys = stored;
    return next;
  }
  const keep = new Set(incoming.passkeys.map((item: any) => String(item?.credentialId || "")).filter(Boolean));
  const kept = stored.filter((passkey) => keep.has(passkey.credentialId));
  if (kept.length) next.passkeys = kept;
  else delete next.passkeys;
  return next;
};

const fieldsOf = (content: any): { label: string; value: string }[] =>
  content && typeof content === "object" && Array.isArray(content.customFields)
    ? content.customFields.map((field: any) => ({
        label: String(field?.label ?? ""),
        value: String(field?.value ?? ""),
      }))
    : [];

const bodyOf = (content: any) =>
  typeof content === "string" ? content : String(content?.mainContent ?? "");

/**
 * What changed between two states, by name only. Same rules as the server's
 * history for readable items (notes_back VersionService.describeChanges).
 */
export const describeChanges = (
  before: Omit<VersionPayload, "changes">,
  after: Omit<VersionPayload, "changes">
) => {
  const changes: string[] = [];
  if (before.title !== after.title) changes.push("Name");
  if (before.category !== after.category) changes.push("Category");
  if (JSON.stringify(before.tags || []) !== JSON.stringify(after.tags || [])) changes.push("Tags");
  if (bodyOf(before.content) !== bodyOf(after.content)) changes.push("Notes");
  const old = fieldsOf(before.content);
  const next = fieldsOf(after.content);
  const labels = [...new Set([...old, ...next].map((field) => field.label))];
  for (const label of labels) {
    const a = old.filter((field) => field.label === label).map((field) => field.value);
    const b = next.filter((field) => field.label === label).map((field) => field.value);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push(label || "A field");
  }
  return [...new Set(changes)];
};
