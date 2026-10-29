// End-to-end items in the vault app (E2E_DESIGN.md, stages 10.3 and 10.4):
// the steps between the server's sealed copies and the items the screens show.
//
// Items arrive sealed and are opened here (openNotes); saves are sealed here
// before they leave (sealCreate, sealUpdate). Search, tag filters and password
// health run here too, because the server can't read these items.
//
// Sharing: the server answers what key copies an action needs, and withE2E
// makes them here (fulfillNeeds) and sends the action again. Owners' and
// admins' browsers also do the background work the server asks for
// (runKeyTasks): encrypt collections, give keys to newcomers, replace keys.
import { fetcherGet, fetcherPost } from "../configs/axios";
import {
  describeChanges,
  mergePasskeys,
  newCollectionKey,
  openCollectionKey,
  openCollectionName,
  sealCollectionName,
  openFromCollection,
  openItemData,
  openItemKey,
  openSharedItemKey,
  openVersion,
  sealCollectionKey,
  sealItemData,
  sealNewItem,
  sealVersion,
  shareItemKey,
  wrapForCollection,
  type ItemPayload,
  type VersionPayload,
} from "../crypto/items";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";
import type { Note } from "../store/noteStore";
import { categoryKey } from "./noteCategory";
import { noteBody, noteFields } from "./noteFields";
import { isSecretField } from "./secretField";

/** How someone other than the owner opens an item: a shared key, or a collection's. */
interface KeyPaths {
  share?: string;
  collections: { collectionId: number; keyVersion: number; itemKey: string; collectionKey: string }[];
}

type RawNote = Note & {
  e2e?: boolean;
  e2eId?: string | null;
  itemKey?: string | null;
  encData?: string | null;
  e2eKeys?: KeyPaths;
};

// Open item keys (by e2eId) and collection keys (by id and version), while the vault is open.
const itemKeys = new Map<string, Uint8Array>();
const collectionKeys = new Map<string, Uint8Array>();
// Collection names opened here (encrypted ones), by collection id.
const collectionNames = new Map<number, string>();
useKeyStore.subscribe((state) => {
  if (state.keys) return;
  itemKeys.clear();
  collectionKeys.clear();
  collectionNames.clear();
});

/** Is this account's vault end-to-end, and open in this tab? */
export const e2eActive = () => !!useAuthStore.getState().me?.e2eEnabled && !!useKeyStore.getState().keys;

const userKey = () => {
  const keys = useKeyStore.getState().keys;
  if (!keys) throw new Error("Your vault is locked. Unlock it and try again.");
  return keys.userKey;
};

const openKeys = () => {
  const keys = useKeyStore.getState().keys;
  if (!keys) throw new Error("Your vault is locked. Unlock it and try again.");
  return keys;
};

/** A collection key this person holds (sealed to them), opened. */
const collectionKeyFor = async (collectionId: number, keyVersion: number, sealed?: string | null) => {
  const name = `${collectionId}:${keyVersion}`;
  const cached = collectionKeys.get(name);
  if (cached) return cached;
  if (!sealed) throw new Error("You don't have this collection's key yet.");
  const keys = openKeys();
  const key = await openCollectionKey(keys.privateKey, keys.publicKey, collectionId, keyVersion, sealed);
  collectionKeys.set(name, key);
  return key;
};

class NoKeyError extends Error {}

/** An item's key: the owner's copy, a key shared with this person, or through a collection. */
const keyFor = async (note: { e2eId?: string | null; itemKey?: string | null; e2eKeys?: KeyPaths }) => {
  const e2eId = String(note.e2eId || "");
  const cached = itemKeys.get(e2eId);
  if (cached) return cached;
  let key: Uint8Array | null = null;
  if (note.itemKey) {
    key = await openItemKey(userKey(), e2eId, note.itemKey);
  } else if (note.e2eKeys?.share) {
    const keys = openKeys();
    key = await openSharedItemKey(keys.privateKey, keys.publicKey, e2eId, note.e2eKeys.share);
  } else {
    for (const path of note.e2eKeys?.collections || []) {
      try {
        const collectionKey = await collectionKeyFor(path.collectionId, path.keyVersion, path.collectionKey);
        key = await openFromCollection(collectionKey, path.collectionId, e2eId, path.itemKey);
        break;
      } catch {
        /* Try the next collection. */
      }
    }
  }
  if (!key) throw new NoKeyError("No key for this item yet.");
  itemKeys.set(e2eId, key);
  return key;
};

/** An item's key by id, fetching the item if its key isn't open yet. */
const keyForId = async (noteId: number, e2eId: string) =>
  itemKeys.get(e2eId) || keyFor(await fetcherGet(`/api/notes/${noteId}`));

const payloadOf = (note: Partial<Note>): ItemPayload => ({
  title: String(note.title ?? ""),
  content: note.content ?? { mainContent: "", customFields: [] },
  comment: note.comment || "",
  project: note.project || null,
  tags: Array.isArray(note.tags) ? note.tags : [],
  category: String(note.category || "note"),
});

const versionStateOf = (payload: ItemPayload) => ({
  title: payload.title,
  content: payload.content,
  tags: payload.tags,
  category: payload.category,
});

// ---------------------------------------------------------------- opening

/** An item as the screens use it: sealed fields opened, readable ones kept. */
export const openNote = async <T extends Partial<RawNote>>(note: T): Promise<T> => {
  if (!note?.e2e) return note;
  try {
    const payload = await openItemData(await keyFor(note), String(note.e2eId), String(note.encData));
    return {
      ...note,
      title: payload.title,
      content: payload.content as Note["content"],
      comment: payload.comment || "",
      project: payload.project || undefined,
      tags: payload.tags || [],
    };
  } catch (error) {
    // Shown like any item that can't be read; it can't be edited either.
    const title = !useAuthStore.getState().me?.e2eEnabled
      ? "Turn on end-to-end encryption to open this item"
      : error instanceof NoKeyError
        ? "Waiting for an owner or admin to give you access"
        : "Item can't be opened";
    return { ...note, title, content: { mainContent: "", customFields: [], decryptionFailed: true } };
  }
};

export const openNotes = <T extends Partial<RawNote>>(notes: T[]) => Promise.all(notes.map((note) => openNote(note)));

// ---------------------------------------------------------------- saving

const SEALED_FIELDS = ["title", "content", "comment", "project", "tags"] as const;

const withoutSealedFields = (note: Partial<Note>) => {
  const rest: Record<string, unknown> = { ...note };
  SEALED_FIELDS.forEach((field) => delete rest[field]);
  return rest;
};

/** The request body for a new item, sealed. Readable fields are left out. */
export const sealCreate = async (note: Partial<Note>) => {
  const payload = payloadOf(note);
  const { sealed, key } = await sealNewItem(userKey(), payload);
  itemKeys.set(sealed.e2eId, key);
  const version = await sealVersion(key, sealed.e2eId, { ...versionStateOf(payload), changes: ["Created"] });
  return { ...withoutSealedFields(note), category: payload.category, e2e: sealed, version };
};

/**
 * The request body to save changes to an end-to-end item. `current` is the
 * item as the server has it now (opened): the whole sealed payload is
 * replaced, so fields the change doesn't touch come from it.
 */
export const sealUpdate = async (current: RawNote, changes: Partial<Note>) => {
  const rest = withoutSealedFields(changes);
  const touched = SEALED_FIELDS.some((field) => changes[field] !== undefined) || changes.category !== undefined;
  if (!touched) return rest;
  // Sealing over what couldn't be opened would replace the real data with the placeholder.
  if (current.content?.decryptionFailed) throw new Error("This item can't be opened, so it can't be changed.");
  const before = payloadOf(current);
  // Saved passkeys (with private keys) live in the sealed content: kept unless removed on purpose.
  const after = payloadOf({
    ...current,
    ...changes,
    ...(changes.content !== undefined ? { content: mergePasskeys(current.content, changes.content) } : {}),
  });
  const key = await keyFor(current);
  const e2eId = String(current.e2eId);
  const changed = describeChanges(versionStateOf(before), versionStateOf(after));
  return {
    ...rest,
    category: after.category,
    encData: await sealItemData(key, e2eId, after),
    ...(changed.length ? { version: await sealVersion(key, e2eId, { ...versionStateOf(after), changes: changed }) } : {}),
  };
};

// ---------------------------------------------------------------- versions

export interface OpenedVersion extends Partial<VersionPayload> {
  id: number;
  createdAt: string;
  current?: boolean;
  changedBy?: { id: number; name: string } | null;
  e2e?: boolean;
  encData?: string;
}

/** A version list or a single version, opened if sealed. */
export const openVersions = async <T extends OpenedVersion>(note: Partial<RawNote>, versions: T[]): Promise<T[]> => {
  if (!note.e2e) return versions;
  const key = await keyFor(note);
  return Promise.all(
    versions.map(async (version) => {
      if (!version.e2e || !version.encData) return version;
      try {
        return { ...version, ...(await openVersion(key, String(note.e2eId), version.encData)) };
      } catch {
        return { ...version, title: "Version can't be opened", changes: [] };
      }
    })
  );
};

// ---------------------------------------------------------------- search, filters, health

/** Same fields as the server's search: secret values are never searched. */
export const matchesSearch = (note: Note, search: string) => {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const fields = noteFields(note);
  return [
    note.title,
    note.project,
    ...(note.collections || []).map((collection) => collection.name),
    ...(note.tags || []),
    noteBody(note),
    ...fields.map((field) => field.label),
    ...fields.filter((field) => !isSecretField(field.label)).map((field) => field.value),
  ].some((part) => typeof part === "string" && part.toLowerCase().includes(q));
};

export interface ClientFilters {
  search?: string;
  tag?: string;
  project?: string;
}

export const applyClientFilters = <T extends Note>(notes: T[], filters?: ClientFilters) =>
  notes.filter(
    (note) =>
      (!filters?.tag || filters.tag === "all" || (note.tags || []).includes(filters.tag)) &&
      (!filters?.project || filters.project === "all" || note.project === filters.project) &&
      matchesSearch(note, filters?.search || "")
  );

const STALE_MS = 180 * 24 * 60 * 60 * 1000;
const passwordsOf = (note: Note) =>
  noteFields(note)
    .filter((field) => /pass/i.test(field.label) && field.value)
    .map((field) => field.value);

const isWeak = (value: string) => {
  if (value.length < 12) return true;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((rule) => rule.test(value)).length;
  return classes < 3;
};

type BreachRow = { noteId: number; count?: number; checkedAt: string };
let breachCache: { at: number; rows: BreachRow[] } | null = null;

const breachRows = async () => {
  if (breachCache && Date.now() - breachCache.at < 60 * 1000) return breachCache.rows;
  try {
    const status = await fetcherGet("/api/notes/health/breaches");
    breachCache = { at: Date.now(), rows: status?.results || [] };
  } catch {
    breachCache = { at: Date.now(), rows: [] };
  }
  return breachCache.rows;
};

/** After a leak check the counts changed: read them again. */
export const forgetBreachCache = () => {
  breachCache = null;
};

/**
 * Password health worked out here, over every personal login: the server can't
 * read end-to-end items, so its answer would miss them (and reuse across them).
 * Same rules as the server's (NoteService.passwordHealthByNoteId).
 */
export const withHealth = async <T extends Note>(notes: T[]): Promise<T[]> => {
  const personal = (note: Note) =>
    categoryKey(note.category) === "password" &&
    note.isOwner !== false &&
    !(note.collections || []).some((collection) => collection.companyId) &&
    !note.collection?.companyId;
  const logins = notes.filter(personal);
  if (!logins.length) return notes;
  const counts = new Map<string, number>();
  logins.forEach((note) => new Set(passwordsOf(note)).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1)));
  const breaches = new Map((await breachRows()).map((row) => [row.noteId, row]));
  return notes.map((note) => {
    if (!personal(note)) return note;
    const values = passwordsOf(note);
    if (!values.length) return { ...note, passwordHealth: undefined };
    const result = breaches.get(note.id);
    const breached =
      result && new Date(result.checkedAt).getTime() >= new Date(note.updatedAt).getTime() ? result.count || 0 : 0;
    const health = {
      weak: values.some(isWeak),
      reused: values.some((value) => (counts.get(value) || 0) > 1),
      stale: new Date(note.updatedAt).getTime() < Date.now() - STALE_MS,
      breached,
    };
    return { ...note, passwordHealth: health.weak || health.reused || health.stale || breached ? health : undefined };
  });
};

// ---------------------------------------------------------------- collection names

interface NamedCollection {
  id: number;
  name: string;
  encName?: string | null;
  nameKey?: string | null;
  e2eKey?: string | null;
}

/** The name the screens show for a collection: its own, or the one opened here. */
export const collectionName = (id: number, name?: string) => name || collectionNames.get(id) || "Collection";

/**
 * Collections from the API with their names opened: encrypted with the
 * person's user key, or with a collection key they hold (`e2eKey`).
 */
export const openCollectionNames = async <T extends NamedCollection>(list: T[]): Promise<T[]> =>
  Promise.all(
    list.map(async (collection) => {
      if (!collection.encName || !collection.nameKey) return collection;
      try {
        const key =
          collection.nameKey === "user"
            ? userKey()
            : await collectionKeyFor(collection.id, Number(collection.nameKey.slice(1)), collection.e2eKey);
        const name = await openCollectionName(key, collection.id, collection.nameKey, collection.encName);
        collectionNames.set(collection.id, name);
        return { ...collection, name };
      } catch {
        return { ...collection, name: "Collection" };
      }
    })
  );

/** A new collection's name for an end-to-end account: encrypted with the user key. */
export const sealNewCollectionName = async (name: string) => ({
  name: "",
  encName: await sealCollectionName(userKey(), 0, "user", name),
  nameKey: "user",
});

/** A renamed collection's name, encrypted the same way as before. */
export const sealRenamedCollection = async (collection: NamedCollection, name: string) => {
  if (!collection.encName || !collection.nameKey) return { name };
  const key =
    collection.nameKey === "user"
      ? userKey()
      : await collectionKeyFor(collection.id, Number(collection.nameKey.slice(1)), collection.e2eKey);
  collectionNames.set(collection.id, name);
  return { name: "", encName: await sealCollectionName(key, collection.id, collection.nameKey, name), nameKey: collection.nameKey };
};

/** Items carry their collections' names; encrypted ones come empty and are filled in here. */
const withCollectionNames = <T extends Note>(note: T): T => {
  const fill = (item: { id: number; name: string } | null | undefined) =>
    item && !item.name ? { ...item, name: collectionName(item.id) } : item;
  if (!note.collections?.some((item) => !item.name) && !(note.collection && !note.collection.name)) return note;
  return {
    ...note,
    collections: (note.collections || []).map((item) => fill(item) as typeof item),
    collection: fill(note.collection) as Note["collection"],
  };
};

/** A list from the API, ready for the screens. */
export const prepareNotes = async (notes: RawNote[], filters?: ClientFilters): Promise<Note[]> => {
  if (!notes.some((note) => note.e2e) && !e2eActive()) return notes;
  const opened = (await openNotes(notes)).map(withCollectionNames);
  return applyClientFilters(await withHealth(opened), filters);
};

// ---------------------------------------------------------------- unsealing to share

/**
 * Make end-to-end items readable again, so they can be shared (until stage
 * 10.4 brings shared keys). Versions come along, opened.
 */
export const unsealItems = async (noteIds: number[]) => {
  const items = [];
  for (const id of noteIds) {
    const note: RawNote = await fetcherGet(`/api/notes/${id}`);
    if (!note?.e2e) continue;
    const opened = await openNote(note);
    if ((opened.content as { decryptionFailed?: boolean })?.decryptionFailed) {
      throw new Error(`"${note.title || "An item"}" can't be opened, so it can't be shared.`);
    }
    const versions = await openVersions(note, (await fetcherGet(`/api/notes/${id}/versions`)) as OpenedVersion[]);
    items.push({
      id,
      ...payloadOf(opened),
      versions: versions
        .filter((version) => version.content !== undefined)
        .map(({ id: versionId, title, content, tags, category, changes }) => ({
          id: versionId,
          title,
          content,
          tags,
          category,
          changes,
        })),
    });
  }
  if (items.length) await fetcherPost("/api/notes/e2e/unseal", { items });
};

// ---------------------------------------------------------------- key copies the server asks for

export interface KeyNeeds {
  collections: {
    collectionId: number;
    keyVersion: number;
    create: boolean;
    members: { userId: number; publicKey: string }[];
    myKey?: string | null;
  }[];
  items: { noteId: number; e2eId: string; collectionId: number; keyVersion: number }[];
  shares: { noteId: number; e2eId: string; userId: number; publicKey: string }[];
}

/**
 * Make the key copies an action needs: a new collection key (or the existing
 * one) sealed to people, item keys wrapped with collection keys, item keys
 * sealed to people.
 */
export const fulfillNeeds = async (needs: KeyNeeds) => {
  const made = new Map<number, Uint8Array>();
  const collections = [];
  for (const entry of needs.collections || []) {
    const key = entry.create
      ? newCollectionKey()
      : await collectionKeyFor(entry.collectionId, entry.keyVersion, entry.myKey);
    // A new key is kept for this request only: until the server accepts it,
    // it may lose to one another browser made at the same time.
    made.set(entry.collectionId, key);
    if (!entry.members.length) continue;
    collections.push({
      collectionId: entry.collectionId,
      keyVersion: entry.keyVersion,
      create: entry.create,
      keys: await Promise.all(
        entry.members.map(async (member) => ({
          userId: member.userId,
          wrappedKey: await sealCollectionKey(member.publicKey, entry.collectionId, entry.keyVersion, key),
        }))
      ),
    });
  }
  const items = [];
  for (const need of needs.items || []) {
    const collectionKey =
      made.get(need.collectionId) || collectionKeys.get(`${need.collectionId}:${need.keyVersion}`);
    if (!collectionKey) throw new Error("A collection key is missing. Try again.");
    const itemKey = await keyForId(need.noteId, need.e2eId);
    items.push({
      noteId: need.noteId,
      collectionId: need.collectionId,
      keyVersion: need.keyVersion,
      wrappedKey: await wrapForCollection(collectionKey, need.collectionId, need.e2eId, itemKey),
    });
  }
  const shares = [];
  for (const need of needs.shares || []) {
    const itemKey = await keyForId(need.noteId, need.e2eId);
    shares.push({ noteId: need.noteId, userId: need.userId, wrappedKey: await shareItemKey(need.publicKey, need.e2eId, itemKey) });
  }
  return { collections, items, shares };
};

/**
 * Runs an action that may need end-to-end keys. If the server asks for key
 * copies, they're made here and the action is sent again with them; if
 * someone involved has no keys, those items are made readable first.
 */
export const withE2E = async <T>(
  action: (e2eKeys?: unknown) => Promise<T>,
  { unseal = true }: { unseal?: boolean } = {}
): Promise<T> => {
  let e2eKeys: unknown;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await action(e2eKeys);
    } catch (error: any) {
      if (attempt >= 4 || !e2eActive()) throw error;
      if (error?.code === "e2e_keys_needed") {
        e2eKeys = await fulfillNeeds(error.needs);
        continue;
      }
      const ids: number[] = error?.code === "e2e_items" ? error.noteIds || [] : [];
      if (!ids.length || !unseal) throw error;
      await unsealItems(ids);
      e2eKeys = undefined;
    }
  }
};

// ---------------------------------------------------------------- background work for owners and admins

let tasksRunning: Promise<number> | null = null;

/**
 * What the server asks of an owner's or admin's browser: encrypt collections
 * everyone in them can now open, give the collection key to people who just
 * got access, and replace it after someone lost access. Returns how many
 * people got a key.
 */
export const runKeyTasks = () => {
  if (!tasksRunning) {
    tasksRunning = (async () => {
      if (!e2eActive()) return 0;
      const { encrypt = [], grant = [], rotate = [], names = [] } = await fetcherGet("/api/collections/e2e/tasks");
      let granted = 0;
      const work = [...encrypt, ...grant];
      if (work.length) {
        const made = await fulfillNeeds({ collections: work, items: [], shares: [] });
        if (made.collections.length) {
          await fetcherPost("/api/collections/e2e/keys", { collections: made.collections });
          granted += grant.reduce((sum: number, entry: KeyNeeds["collections"][number]) => sum + entry.members.length, 0);
        }
      }
      for (const task of rotate) {
        const oldKey = await collectionKeyFor(task.collectionId, task.keyVersion, task.myKey);
        const keyVersion = task.keyVersion + 1;
        const key = newCollectionKey();
        const keys = await Promise.all(
          task.members.map(async (member: { userId: number; publicKey: string }) => ({
            userId: member.userId,
            wrappedKey: await sealCollectionKey(member.publicKey, task.collectionId, keyVersion, key),
          }))
        );
        const items = await Promise.all(
          task.items.map(async (item: { noteId: number; e2eId: string; wrappedKey: string }) => ({
            noteId: item.noteId,
            wrappedKey: await wrapForCollection(
              key,
              task.collectionId,
              item.e2eId,
              await openFromCollection(oldKey, task.collectionId, item.e2eId, item.wrappedKey)
            ),
          }))
        );
        // A name encrypted with the old key, encrypted again with the new one.
        const encName = task.encName
          ? await sealCollectionName(
              key,
              task.collectionId,
              `v${keyVersion}`,
              await openCollectionName(oldKey, task.collectionId, `v${task.keyVersion}`, task.encName)
            )
          : undefined;
        await fetcherPost(`/api/collections/${task.collectionId}/e2e/rotate`, { keyVersion, keys, items, encName });
        collectionKeys.set(`${task.collectionId}:${keyVersion}`, key);
      }
      // Collection names into the right state: encrypted for the owner alone,
      // with the collection key, or readable (shared with someone without keys).
      const fixed = [];
      for (const task of names) {
        try {
          const keyOf = async (nameKey: string) =>
            nameKey === "user" ? userKey() : await collectionKeyFor(task.collectionId, Number(nameKey.slice(1)), task.myKey);
          const name = task.encName
            ? await openCollectionName(await keyOf(task.nameKey), task.collectionId, task.nameKey, task.encName)
            : String(task.name || "");
          if (!name) continue;
          fixed.push(
            task.want === "plain"
              ? { collectionId: task.collectionId, name }
              : {
                  collectionId: task.collectionId,
                  nameKey: task.want,
                  encName: await sealCollectionName(await keyOf(task.want), task.collectionId, task.want, name),
                }
          );
        } catch {
          /* Not openable here; another owner or admin may do it. */
        }
      }
      if (fixed.length) await fetcherPost("/api/collections/e2e/names", { items: fixed });
      // A collection that just got (or changed) its key: its name moves to it in another pass.
      if (encrypt.length || rotate.length) {
        tasksRunning = null;
        granted += await runKeyTasks();
      }
      return granted;
    })().finally(() => {
      tasksRunning = null;
    });
  }
  return tasksRunning;
};

// ---------------------------------------------------------------- moving existing items

let migrating: Promise<number> | null = null;

/**
 * Encrypt the account's existing items here, then delete the server's
 * readable copies (with their history). Shared items get key copies for the
 * people and collections that reach them. Runs after the vault opens; an item
 * that can't move yet stays as it was and is tried again next time.
 */
export const migrateItems = () => {
  if (!migrating) {
    migrating = (async () => {
      let moved = 0;
      for (let round = 0; round < 100 && e2eActive(); round += 1) {
        const { items, remaining } = await fetcherGet("/api/notes/e2e/pending");
        if (!items?.length) break;
        const sealed = [];
        for (const item of items) {
          const payload = payloadOf(item);
          const { sealed: parts, key } = await sealNewItem(userKey(), payload);
          const versions = await Promise.all(
            (item.versions || []).map(async (version: VersionPayload & { id: number }) => ({
              id: version.id,
              encData: await sealVersion(key, parts.e2eId, {
                title: String(version.title ?? ""),
                content: version.content,
                tags: Array.isArray(version.tags) ? version.tags : [],
                category: String(version.category || payload.category),
                changes: Array.isArray(version.changes) ? version.changes : [],
              }),
            }))
          );
          const needs = item.needs || { shares: [], collections: [] };
          const shares = await Promise.all(
            (needs.shares || []).map(async (share: { userId: number; publicKey: string }) => ({
              userId: share.userId,
              wrappedKey: await shareItemKey(share.publicKey, parts.e2eId, key),
            }))
          );
          const collections = await Promise.all(
            (needs.collections || []).map(async (entry: { collectionId: number; keyVersion: number; myKey?: string }) => ({
              collectionId: entry.collectionId,
              keyVersion: entry.keyVersion,
              wrappedKey: await wrapForCollection(
                await collectionKeyFor(entry.collectionId, entry.keyVersion, entry.myKey),
                entry.collectionId,
                parts.e2eId,
                key
              ),
            }))
          );
          // updatedAt: the server skips the item if it changed since (tried again next time).
          sealed.push({ id: item.id, updatedAt: item.updatedAt, ...parts, versions, shares, collections });
        }
        const result = await fetcherPost("/api/notes/e2e/migrate", { items: sealed });
        moved += result?.moved || 0;
        // Nothing moved this round: stop rather than loop on the same items.
        if (!result?.moved || !remaining) break;
      }
      return moved;
    })().finally(() => {
      migrating = null;
    });
  }
  return migrating;
};
