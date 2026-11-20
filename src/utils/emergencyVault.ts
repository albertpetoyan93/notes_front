// The contact's side of emergency access: opening an owner's personal vault in
// this browser, with what the owner sealed to this contact.
import { openBundleWithUserKey, type KeyBundle } from "../crypto/account";
import {
  openEmergencyKeyAsContact,
  openItemFromEmergency,
  openNameFromEmergency,
  openOwnerUserKey,
} from "../crypto/emergency";
import { openCollectionKey, openCollectionName, openItemData, openItemKey } from "../crypto/items";
import type { NoteField } from "./noteFields";

export interface RawItem {
  e2e?: boolean;
  e2eId?: string;
  /** Before the emergency key: the item key wrapped with the owner's user key. */
  itemKey?: string;
  /** With the emergency key: the item key copied under it. */
  emergencyKey?: string;
  encData?: string;
  title?: string;
  content?: unknown;
  category: string;
  tags?: string[];
  collectionIds?: number[];
}

export interface RawCollection {
  id: number;
  name: string | null;
  encName: string | null;
  nameKey?: string | null;
  keyVersion?: number | null;
  collectionKey?: string | null;
}

interface Owner {
  id: number;
  name: string;
  email: string;
}

/** Confirmed before the emergency key (not upgraded yet by the owner's browser). */
export interface LegacyVaultResponse {
  owner: Owner;
  grantedAt: string | null;
  scheme?: "user-key";
  sealedUserKey: string;
  publicKey: string | null;
  protectedPrivateKey: string | null;
  collections: RawCollection[];
  items: RawItem[];
}

export interface EmergencyKeyVaultResponse {
  owner: Owner;
  grantedAt: string | null;
  scheme: "emergency-key";
  keyVersion: number;
  sealedKey: string;
  collections: RawCollection[];
  items: RawItem[];
  /** Personal items the owner's browser hasn't copied yet. */
  waiting: number;
}

export type VaultResponse = LegacyVaultResponse | EmergencyKeyVaultResponse;

export interface Item {
  key: string;
  title: string;
  category: string;
  content: { mainContent?: string; customFields?: NoteField[] } | string;
  tags: string[];
  collectionIds: number[];
  failed: boolean;
}

type MyKeys = { privateKey: Uint8Array; publicKey: string };

const openItems = async (raws: RawItem[], keyOf: (raw: RawItem) => Promise<Uint8Array>): Promise<Item[]> => {
  const items = await Promise.all(
    raws.map(async (raw, index) => {
      const base = { key: String(index), category: raw.category, collectionIds: raw.collectionIds || [] };
      try {
        const key = await keyOf(raw);
        const payload = await openItemData(key, String(raw.e2eId), String(raw.encData));
        return {
          ...base,
          title: payload.title || "Untitled",
          content: payload.content as Item["content"],
          tags: payload.tags || [],
          failed: false,
        };
      } catch {
        return { ...base, title: "Item can't be opened", content: "", tags: [], failed: true };
      }
    })
  );
  return items.sort((a, b) => a.title.localeCompare(b.title));
};

/** With the emergency key: it opens the owner's personal items and their collection names, nothing else. */
const openWithEmergencyKey = async (id: number, data: EmergencyKeyVaultResponse, mine: MyKeys) => {
  const ek = await openEmergencyKeyAsContact(mine.privateKey, mine.publicKey, id, data.keyVersion, data.sealedKey);
  const names = new Map<number, string>();
  for (const collection of data.collections) {
    try {
      names.set(
        collection.id,
        collection.encName ? await openNameFromEmergency(ek, collection.id, data.keyVersion, collection.encName) : "A collection"
      );
    } catch {
      names.set(collection.id, "A collection");
    }
  }
  const items = await openItems(data.items, (raw) =>
    openItemFromEmergency(ek, String(raw.e2eId), data.keyVersion, String(raw.emergencyKey))
  );
  return { names, items };
};

/** Before the emergency key: the owner's user key, sealed to this contact. */
const openWithUserKey = async (id: number, data: LegacyVaultResponse, mine: MyKeys) => {
  const userKey = await openOwnerUserKey(mine.privateKey, mine.publicKey, id, data.sealedUserKey);
  // The owner's private key opens collection keys, for names sealed with one.
  let ownerKeys: MyKeys | null = null;
  if (data.protectedPrivateKey && data.publicKey) {
    ownerKeys = await openBundleWithUserKey(userKey, {
      protectedPrivateKey: data.protectedPrivateKey,
      publicKey: data.publicKey,
    } as KeyBundle).catch(() => null);
  }
  const names = new Map<number, string>();
  for (const collection of data.collections) {
    try {
      if (!collection.encName) {
        names.set(collection.id, collection.name || "Collection");
      } else if (collection.nameKey === "user") {
        names.set(collection.id, await openCollectionName(userKey, collection.id, "user", collection.encName));
      } else if (ownerKeys && collection.collectionKey && collection.keyVersion && collection.nameKey) {
        const key = await openCollectionKey(
          ownerKeys.privateKey,
          ownerKeys.publicKey,
          collection.id,
          collection.keyVersion,
          collection.collectionKey
        );
        names.set(collection.id, await openCollectionName(key, collection.id, collection.nameKey, collection.encName));
      } else {
        names.set(collection.id, "A collection");
      }
    } catch {
      names.set(collection.id, "A collection");
    }
  }
  const items = await openItems(data.items, (raw) => openItemKey(userKey, String(raw.e2eId), String(raw.itemKey)));
  return { names, items };
};

/** Opens the owner's vault in this browser with the key they sealed to this contact. */
export const openEmergencyVault = (id: number, data: VaultResponse, mine: MyKeys) =>
  data.scheme === "emergency-key" ? openWithEmergencyKey(id, data, mine) : openWithUserKey(id, data as LegacyVaultResponse, mine);

/** Items the owner's browser hasn't copied yet. */
export const waitingNotice = (waiting: number, owner: string) => {
  if (!waiting) return null;
  return waiting === 1
    ? `1 item isn't ready yet: it's added the next time ${owner} opens 2keevo.`
    : `${waiting} items aren't ready yet: they're added the next time ${owner} opens 2keevo.`;
};
