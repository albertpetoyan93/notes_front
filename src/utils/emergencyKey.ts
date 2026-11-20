// Emergency access: the owner's browser keeps the emergency key's copies up to
// date in the background (plan 2026-11-20-emergency-key.md). The key opens only
// the owner's personal items, so a trusted contact never gets the user key.
import { fetcherGet, fetcherPost } from "../configs/axios";
import {
  newEmergencyKey,
  openEmergencyKey,
  sealEmergencyKeyFor,
  sealNameForEmergency,
  wrapEmergencyKey,
  wrapItemForEmergency,
} from "../crypto/emergency";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";
import { keyForId, openCollectionNames } from "./vaultItems";

interface EmergencyTasks {
  keyVersion: number | null;
  emergencyKey: string | null;
  rotate: boolean;
  items: { noteId: number; e2eId: string }[];
  collections: { id: number }[];
  contacts: { id: number; publicKey: string }[];
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
    try {
      items.push({ noteId: item.noteId, wrappedKey: await wrapItemForEmergency(ek, item.e2eId, version, await keyForId(item.noteId, item.e2eId)) });
    } catch (error) {
      // One item that can't be opened here doesn't hold up the rest; the server asks again next time.
      console.error("Emergency copy failed for an item:", (error as Error)?.message || error);
    }
  }
  const collections: { collectionId: number; encName: string }[] = [];
  if (tasks.collections.length) {
    const wanted = new Set(tasks.collections.map((collection) => collection.id));
    const list = ((await fetcherGet("/api/collections")) || []).filter((row: any) => wanted.has(row.id));
    for (const row of await openCollectionNames(list)) {
      if ((row as any).nameLocked) continue;
      collections.push({ collectionId: row.id, encName: await sealNameForEmergency(ek, row.id, version, row.name || "Collection") });
    }
  }
  const contacts: { id: number; sealedKey: string }[] = [];
  for (const contact of tasks.contacts) {
    contacts.push({ id: contact.id, sealedKey: await sealEmergencyKeyFor(contact.publicKey, contact.id, version, ek) });
  }
  await fetcherPost("/api/emergency/keys", { keyVersion: version, items, collections, contacts });
  // Contacts are listed only once every item is copied: look again after copying items.
  return items.length && !contacts.length ? "again" : "done";
};

/** After the vault opens (and every so often). One run at a time; at most a few passes. */
export const runEmergencyTasks = () => {
  if (!running) {
    running = (async () => {
      for (let i = 0; i < 3; i++) {
        if ((await pass()) === "done") break;
      }
    })().finally(() => {
      running = null;
    });
  }
  return running;
};
