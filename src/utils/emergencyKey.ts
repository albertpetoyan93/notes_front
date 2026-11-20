// Emergency access: the owner's browser keeps the emergency key's copies up to
// date in the background (plan 2026-11-20-emergency-key.md). The key opens only
// the owner's personal items, so a trusted contact never gets the user key.
//
// The server's task list isn't trusted for what goes under the key: an item is
// copied only if its key opens with the owner's own user-key wrap (so not a key
// reached through a company vault or someone's share), a name only if it's under
// the user key or plain, and the key is sealed only to the contact key the owner
// checked (pinned).
import { fetcherGet, fetcherPost } from "../configs/axios";
import {
  newEmergencyKey,
  openEmergencyKey,
  openPinnedContactKey,
  pinContactKey,
  sealEmergencyKeyFor,
  sealNameForEmergency,
  wrapEmergencyKey,
  wrapItemForEmergency,
} from "../crypto/emergency";
import { openCollectionName, openItemKey } from "../crypto/items";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";

interface EmergencyTasks {
  keyVersion: number | null;
  emergencyKey: string | null;
  rotate: boolean;
  items: { noteId: number; e2eId: string; itemKey: string | null }[];
  collections: { id: number; name: string; encName: string | null; nameKey: string | null }[];
  contacts: { id: number; publicKey: string; pinnedKey: string | null }[];
}

let running: Promise<void> | null = null;

/** The current emergency key, opened with the user key; null when there's none yet. */
export const currentEmergencyKey = async (): Promise<{ key: Uint8Array; version: number } | null> => {
  const keys = useKeyStore.getState().keys;
  const me = useAuthStore.getState().me;
  if (!keys || !me?.id) return null;
  const tasks: EmergencyTasks = await fetcherGet("/api/emergency/tasks");
  if (tasks.rotate || !tasks.emergencyKey || !tasks.keyVersion) return null;
  return { key: await openEmergencyKey(keys.userKey, me.id, tasks.keyVersion, tasks.emergencyKey), version: tasks.keyVersion };
};

const skipped = (what: string, error: unknown) =>
  console.warn(`Emergency access: ${what} skipped:`, (error as Error)?.message || error);

const pass = async (): Promise<"again" | "done"> => {
  const keys = useKeyStore.getState().keys;
  const me = useAuthStore.getState().me;
  if (!keys || !me?.id || !me.e2eEnabled) return "done";
  const tasks: EmergencyTasks = await fetcherGet("/api/emergency/tasks");

  if (tasks.rotate) {
    // The first key, or a new one after access that had been granted ended.
    const keyVersion = (tasks.keyVersion ?? 0) + 1;
    await fetcherPost("/api/emergency/keys", {
      keyVersion,
      emergencyKey: await wrapEmergencyKey(keys.userKey, me.id, keyVersion, newEmergencyKey()),
    });
    return "again";
  }
  if (!tasks.keyVersion || !tasks.emergencyKey) return "done";
  if (!tasks.items.length && !tasks.collections.length && !tasks.contacts.length) return "done";

  const version = tasks.keyVersion;
  const ek = await openEmergencyKey(keys.userKey, me.id, version, tasks.emergencyKey);

  const items: { noteId: number; wrappedKey: string }[] = [];
  for (const item of tasks.items) {
    if (!item.itemKey) continue;
    try {
      const key = await openItemKey(keys.userKey, item.e2eId, item.itemKey);
      items.push({ noteId: item.noteId, wrappedKey: await wrapItemForEmergency(ek, item.e2eId, version, key) });
    } catch (error) {
      skipped("an item", error);
    }
  }

  const collections: { collectionId: number; encName: string }[] = [];
  for (const collection of tasks.collections) {
    try {
      let name: string | null = null;
      if (!collection.encName) name = collection.name || "Collection";
      else if (collection.nameKey === "user") name = await openCollectionName(keys.userKey, collection.id, "user", collection.encName);
      // A name under a vault key: left out (the contact sees "A collection").
      if (name !== null) {
        collections.push({ collectionId: collection.id, encName: await sealNameForEmergency(ek, collection.id, version, name) });
      }
    } catch (error) {
      skipped("a collection name", error);
    }
  }

  const contacts: { id: number; sealedKey: string; pinnedKey?: string }[] = [];
  for (const contact of tasks.contacts) {
    try {
      if (contact.pinnedKey) {
        const checked = await openPinnedContactKey(keys.userKey, me.id, contact.id, contact.pinnedKey);
        if (checked !== contact.publicKey) {
          // Not the key the owner checked: never seal to it. Confirming again fixes it.
          console.warn("Emergency access: a contact's key changed; they need to be confirmed again.");
          continue;
        }
        contacts.push({ id: contact.id, sealedKey: await sealEmergencyKeyFor(contact.publicKey, contact.id, version, ek) });
      } else {
        // Confirmed before the emergency key: the key seen now is pinned from here on.
        contacts.push({
          id: contact.id,
          sealedKey: await sealEmergencyKeyFor(contact.publicKey, contact.id, version, ek),
          pinnedKey: await pinContactKey(keys.userKey, me.id, contact.id, contact.publicKey),
        });
      }
    } catch (error) {
      skipped("a contact", error);
    }
  }

  if (!items.length && !collections.length && !contacts.length) return "done";
  await fetcherPost("/api/emergency/keys", { keyVersion: version, items, collections, contacts });
  // Copied items: there may be more (500 a pass), or contacts now waiting for them.
  return items.length ? "again" : "done";
};

/** After the vault opens (and every so often). One run at a time. */
export const runEmergencyTasks = () => {
  if (!running) {
    running = (async () => {
      let failures = 0;
      for (let i = 0; i < 20; i++) {
        try {
          if ((await pass()) === "done") break;
        } catch (error) {
          // Usually another tab got there first: look again once.
          if (++failures > 1) throw error;
        }
      }
    })().finally(() => {
      running = null;
    });
  }
  return running;
};
