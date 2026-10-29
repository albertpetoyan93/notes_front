import { create } from "zustand";
import axios from "../configs/axios";
import {
  e2eActive,
  collectionName,
  openCollectionNames,
  openNote,
  runKeyTasks,
  openNotes,
  sealNewCollectionName,
  sealRenamedCollection,
  prepareNotes,
  sealCreate,
  sealUpdate,
  unsealItems,
  withE2E,
} from "../utils/vaultItems";

export interface NoteContent {
  mainContent: string;
  customFields: Array<{
    label: string;
    value: string;
  }>;
  decryptionFailed?: boolean;
}

export interface Note {
  id: number;
  title: string;
  content: NoteContent | Record<string, any>;
  comment?: string;
  category:
    | "note"
    | "password"
    | "login"
    | "command"
    | "ssh"
    | "db"
    | "address"
    | "card"
    | "other";
  project?: string;
  tags?: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  /** Encrypted in the browser (end-to-end); opened by utils/vaultItems. */
  e2e?: boolean;
  e2eId?: string | null;
  itemKey?: string | null;
  encData?: string | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
  isOwner?: boolean;
  isShared?: boolean;
  sharedByName?: string;
  permission?: "owner" | "view" | "edit";
  collectionId?: number | null;
  collection?: { id: number; name: string; companyId?: number | null } | null;
  collections?: { id: number; name: string; companyId?: number | null }[];
  passwordHealth?: {
    weak: boolean;
    reused: boolean;
    stale: boolean;
    // Times the password appears in known leaks; 0 or missing when not seen.
    breached?: number;
  };
}

// One item for POST /api/notes/import. Collections are given by name and created if missing.
export type ImportedNote = Omit<Partial<Note>, "collections"> & {
  collections?: string[];
};

export interface CollectionItem {
  id: number;
  name: string;
  isOwner: boolean;
  permission: "owner" | "view" | "edit";
  noteCount: number;
}

export interface NoteShare {
  id: number;
  noteId: number;
  sharedByUserId: number;
  sharedWithUserId: number;
  permission: "view" | "edit";
  expiresAt?: string | null;
  createdAt: string;
  sharedWith?: {
    id: number;
    username: string;
    email: string;
    fullName?: string;
  };
}

interface NoteStore {
  notes: Note[];
  loading: boolean;
  error: string | null;
  selectedCategory: string;
  searchQuery: string;
  projects: string[];

  fetchNotes: (filters?: {
    category?: string;
    project?: string;
    tag?: string;
    search?: string;
    isFavorite?: boolean;
    sharedOnly?: boolean;
    trash?: boolean;
    collectionId?: number;
    companyId?: number;
  }) => Promise<void>;
  getNote: (id: number) => Promise<Note>;
  createNote: (note: Partial<Note>) => Promise<Note>;
  updateNote: (id: number, note: Partial<Note>) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  restoreNote: (id: number) => Promise<void>;
  searchUsers: (
    query: string,
    companyId?: number
  ) => Promise<
    { id: number; username: string; email: string; fullName?: string }[]
  >;
  toggleFavorite: (id: number) => Promise<void>;
  getNoteStats: () => Promise<any>;
  getProjects: () => Promise<string[]>;
  shareNote: (
    noteId: number,
    identifier: string | string[],
    permission?: "view" | "edit",
    expiresIn?: string
  ) => Promise<{ shared: NoteShare[]; failed: { identifier: string; message: string }[] }>;
  getNoteShares: (noteId: number) => Promise<NoteShare[]>;
  revokeShare: (noteId: number, userId: number) => Promise<void>;
  exportNotes: () => Promise<VaultBackup>;
  /** A company's items, for its owner (also while the company is suspended). */
  exportCompany: (companyId: number) => Promise<VaultBackup>;
  importNotes: (
    notes: ImportedNote[]
  ) => Promise<{ imported: number; failed: { title: string; message: string }[] }>;
  fetchCollections: () => Promise<CollectionItem[]>;
  createCollection: (name: string) => Promise<CollectionItem>;
  renameCollection: (id: number, name: string) => Promise<CollectionItem>;
  deleteCollection: (id: number) => Promise<void>;
  addNotesToCollection: (
    id: number,
    noteIds: number[]
  ) => Promise<{ added: number; skipped: number }>;
  removeNoteFromCollection: (id: number, noteId: number) => Promise<void>;
  availableCollectionNotes: (
    id: number
  ) => Promise<{ id: number; title: string }[]>;
  shareCollection: (
    id: number,
    identifiers: string[],
    permission?: "view" | "edit",
    expiresIn?: string
  ) => Promise<{ shared: any[]; failed: { identifier: string; message: string }[] }>;
  getCollectionShares: (id: number) => Promise<any[]>;
  revokeCollectionShare: (id: number, userId: number) => Promise<void>;
  emptyTrash: () => Promise<number>;
  bulkUpdateNotes: (
    noteIds: number[],
    action: "trash" | "move",
    collectionId?: number | null
  ) => Promise<{ updated: number; skipped: number }>;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
}

export interface VaultBackup {
  version: number;
  exportedAt: string;
  skipped: number;
  notes: Partial<Note>[];
}

/** A backup file from the server, with end-to-end items opened here (only this browser can). */
const openBackup = async (input: any): Promise<VaultBackup> => {
  // Encrypted collection names come empty, with ids: filled in from the names opened here.
  const backup = {
    ...input,
    notes: (input?.notes || []).map((note: any) => {
      const ids: number[] = note.collectionIds || [];
      const names = (note.collections || []).map((name: string, at: number) => name || collectionName(ids[at]));
      const named = { ...note, collections: names, collection: note.collection || names[0] || null };
      delete named.collectionIds;
      return named;
    }),
  };
  if (!backup.notes.some((note: Partial<Note>) => note.e2e)) return backup;
  // End-to-end items come sealed: open them for the backup file.
  const opened = await openNotes(backup.notes as Partial<Note>[]);
  return {
    ...backup,
    skipped: backup.skipped + opened.filter((note) => (note.content as NoteContent)?.decryptionFailed).length,
    notes: opened
      .filter((note) => !(note.content as NoteContent)?.decryptionFailed)
      .map((note) => {
        const plain: Partial<Note> = { ...note };
        delete plain.e2e;
        delete plain.e2eId;
        delete plain.itemKey;
        delete plain.encData;
        delete (plain as { e2eKeys?: unknown }).e2eKeys;
        return plain;
      }),
  };
};

/** The person's collections, names opened. */
const myCollections = async (): Promise<(CollectionItem & { encName?: string; nameKey?: string; e2eKey?: string })[]> =>
  openCollectionNames((await axios.get("/api/collections")).data);

/** The server can't compare encrypted names, so a duplicate is caught here. */
const assertNewName = async (name: string, exceptId?: number) => {
  const wanted = name.trim().toLowerCase();
  const taken = (await myCollections()).some(
    (item) => item.isOwner && item.id !== exceptId && item.name.trim().toLowerCase() === wanted
  );
  if (taken) throw new Error(`You already have a collection named "${name.trim()}"`);
};

const isE2EConflict = (error: any) => error?.code === "e2e_items";

/** Create an item: sealed in end-to-end vaults, unless it goes into a shared or company collection. */
const postNew = async (note: Partial<Note>) => {
  if (!e2eActive()) return (await axios.post("/api/notes", note)).data;
  // Sealed once: key copies the server asks for are made for this item key.
  const sealed = await sealCreate(note);
  try {
    return (await withE2E((e2eKeys) => axios.post("/api/notes", { ...sealed, e2eKeys }))).data;
  } catch (error) {
    // Someone with access to a target collection has no keys: saved readable.
    if (!isE2EConflict(error)) throw error;
    return (await axios.post("/api/notes", note)).data;
  }
};

/**
 * Save changes to an item. End-to-end items are sealed first; moving one into
 * a shared collection makes it readable, then saves the changes as usual.
 */
const saveChanges = async (id: number, changes: Partial<Note>, known: Note[]) => {
  const listed = known.find((note) => note.id === id);
  if ((listed && !listed.e2e) || !e2eActive()) return (await axios.put(`/api/notes/${id}`, changes)).data;
  // Sealed items are saved whole: start from the server's latest copy, not
  // the list in memory, so a change made elsewhere meanwhile isn't undone.
  const current = await openNote((await axios.get(`/api/notes/${id}`)).data);
  if (!current.e2e) return (await axios.put(`/api/notes/${id}`, changes)).data;
  const body = await sealUpdate(current, changes);
  try {
    return (await withE2E((e2eKeys) => axios.put(`/api/notes/${id}`, { ...body, e2eKeys }), { unseal: false })).data;
  } catch (error) {
    if (!isE2EConflict(error)) throw error;
    await unsealItems([id]);
    return (await axios.put(`/api/notes/${id}`, changes)).data;
  }
};

/** Import into an end-to-end vault: collections by name, each item sealed here. */
const importSealed = async (notes: ImportedNote[]) => {
  const collections: CollectionItem[] = await myCollections();
  const byName = new Map(collections.filter((item) => item.isOwner).map((item) => [item.name.toLowerCase(), item.id]));
  let imported = 0;
  const failed: { title: string; message: string }[] = [];
  for (const item of notes) {
    const title = String(item?.title || "").trim();
    try {
      if (!title) throw new Error("Title is required");
      const collectionIds: number[] = [];
      for (const raw of item.collections || []) {
        const name = String(raw || "").trim().slice(0, 100);
        if (!name) continue;
        let id = byName.get(name.toLowerCase());
        if (!id) {
          id = (await axios.post("/api/collections", await sealNewCollectionName(name))).data.id as number;
          byName.set(name.toLowerCase(), id);
        }
        collectionIds.push(id);
      }
      const rest: Partial<ImportedNote> = { ...item };
      delete rest.collections;
      await postNew({ ...rest, title: title.slice(0, 255), tags: (item.tags || []).slice(0, 20), collectionIds } as Partial<Note>);
      imported += 1;
    } catch {
      failed.push({ title: title || "Untitled", message: "Could not import this note" });
    }
  }
  return { imported, failed };
};

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  loading: false,
  error: null,
  selectedCategory: "all",
  searchQuery: "",
  projects: [],

  fetchNotes: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.category && filters.category !== "all") {
        params.append("category", filters.category);
      }
      if (!e2eActive() && filters?.project && filters.project !== "all") {
        params.append("project", filters.project);
      }
      // End-to-end vaults filter here: the server can't read these items.
      const clientSide = e2eActive();
      if (!clientSide && filters?.tag && filters.tag !== "all") {
        params.append("tag", filters.tag);
      }
      if (!clientSide && filters?.search) {
        params.append("search", filters.search);
      }
      if (filters?.isFavorite) {
        params.append("isFavorite", "true");
      }
      if (filters?.sharedOnly) {
        params.append("sharedOnly", "true");
      }
      if (filters?.trash) {
        params.append("trash", "true");
      }
      if (filters?.collectionId) {
        params.append("collection", String(filters.collectionId));
      }
      if (filters?.companyId) {
        params.append("company", String(filters.companyId));
      }

      const response = await axios.get(`/api/notes?${params.toString()}`);
      set({ notes: await prepareNotes(response.data, filters), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  getNote: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`/api/notes/${id}`);
      set({ loading: false });
      return openNote(response.data);
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createNote: async (note) => {
    set({ loading: true, error: null });
    try {
      const saved = await openNote(await postNew(note));
      set((state) => ({
        notes: [saved, ...state.notes],
        loading: false,
      }));
      return saved;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateNote: async (id, note) => {
    set({ loading: true, error: null });
    try {
      const saved = await openNote(await saveChanges(id, note, get().notes));
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? saved : n)),
        loading: false,
      }));
      return saved;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteNote: async (id) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`/api/notes/${id}`);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  restoreNote: async (id) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`/api/notes/${id}/restore`);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  searchUsers: async (query, companyId) => {
    const response = await axios.get("/api/auth/users", {
      params: { q: query, ...(companyId ? { company: companyId } : {}) },
    });
    return response.data;
  },

  toggleFavorite: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;

    const nextFavorite = !note.isFavorite;
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, isFavorite: nextFavorite } : n
      ),
    }));

    try {
      const response = await axios.post(`/api/notes/${id}/favorite`);
      const saved = await openNote(response.data);
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...saved, passwordHealth: n.passwordHealth } : n)),
      }));
    } catch (error: any) {
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, isFavorite: !nextFavorite } : n
        ),
        error: error.message,
      }));
      throw error;
    }
  },

  getNoteStats: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get("/api/notes/stats");
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getProjects: async () => {
    try {
      const response = await axios.get("/api/notes/projects");
      set({ projects: response.data });
      return response.data;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  shareNote: async (noteId, identifier, permission = "view", expiresIn = "never") => {
    const identifiers = Array.isArray(identifier) ? identifier : [identifier];
    const response = await withE2E((e2eKeys) =>
      axios.post(`/api/notes/${noteId}/share`, {
        identifiers,
        permission,
        expiresIn,
        e2eKeys,
      })
    );
    return response.data;
  },

  getNoteShares: async (noteId) => {
    const response = await axios.get(`/api/notes/${noteId}/shares`);
    return response.data;
  },

  revokeShare: async (noteId, userId) => {
    await axios.delete(`/api/notes/${noteId}/share/${userId}`);
  },

  exportNotes: async () => {
    const response = await axios.get("/api/notes/export");
    return openBackup(response.data);
  },

  exportCompany: async (companyId: number) => {
    const response = await axios.get(`/api/companies/${companyId}/export`);
    return openBackup(response.data);
  },

  importNotes: async (notes) => {
    // End-to-end vaults encrypt each item here: a readable copy never reaches the server.
    if (e2eActive()) return importSealed(notes);
    const response = await axios.post("/api/notes/import", { notes });
    return response.data;
  },

  fetchCollections: async () => {
    const response = await axios.get("/api/collections");
    return openCollectionNames(response.data);
  },

  // End-to-end accounts: the name is encrypted here, so the duplicate check is too.
  createCollection: async (name: string) => {
    if (!e2eActive()) return (await axios.post("/api/collections", { name })).data;
    await assertNewName(name);
    const response = await axios.post("/api/collections", await sealNewCollectionName(name.trim()));
    return (await openCollectionNames([response.data]))[0];
  },

  renameCollection: async (id: number, name: string) => {
    const current = e2eActive() ? (await myCollections()).find((item) => item.id === id) : undefined;
    if (!current?.encName) return (await axios.put(`/api/collections/${id}`, { name })).data;
    await assertNewName(name, id);
    const response = await axios.put(`/api/collections/${id}`, await sealRenamedCollection(current, name.trim()));
    return (await openCollectionNames([response.data]))[0];
  },

  deleteCollection: async (id: number) => {
    await axios.delete(`/api/collections/${id}`);
  },

  addNotesToCollection: async (id: number, noteIds: number[]) => {
    const response = await withE2E((e2eKeys) => axios.post(`/api/collections/${id}/notes`, { noteIds, e2eKeys }));
    // A collection that just got a key: its name moves to it now, not on the next sign-in.
    runKeyTasks().catch(() => undefined);
    return response.data;
  },

  removeNoteFromCollection: async (id: number, noteId: number) => {
    await axios.delete(`/api/collections/${id}/notes/${noteId}`);
  },

  availableCollectionNotes: async (id: number) => {
    const response = await axios.get(`/api/collections/${id}/available-notes`);
    return (await openNotes(response.data)).map(({ id: noteId, title }) => ({ id: noteId as number, title: title as string }));
  },

  shareCollection: async (
    id: number,
    identifiers: string[],
    permission: "view" | "edit" = "view",
    expiresIn = "never"
  ) => {
    const response = await withE2E((e2eKeys) =>
      axios.post(`/api/collections/${id}/share`, {
        identifiers,
        permission,
        expiresIn,
        e2eKeys,
      })
    );
    runKeyTasks().catch(() => undefined);
    return response.data;
  },

  getCollectionShares: async (id: number) => {
    const response = await axios.get(`/api/collections/${id}/shares`);
    return response.data;
  },

  revokeCollectionShare: async (id: number, userId: number) => {
    await axios.delete(`/api/collections/${id}/share/${userId}`);
  },

  emptyTrash: async () => {
    const response = await axios.delete("/api/notes/trash");
    return response.data.deleted;
  },

  bulkUpdateNotes: async (noteIds, action, collectionId = null) => {
    const response = await withE2E((e2eKeys) =>
      axios.post("/api/notes/bulk", {
        noteIds,
        action,
        collectionId,
        e2eKeys,
      })
    );
    return response.data;
  },

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
    get().fetchNotes({ category, search: get().searchQuery });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchNotes({ category: get().selectedCategory, search: query });
  },
}));
