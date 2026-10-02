import { create } from "zustand";
import axios from "../configs/axios";

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
  };
}

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
  exportNotes: () => Promise<{
    version: number;
    exportedAt: string;
    skipped: number;
    notes: Partial<Note>[];
  }>;
  importNotes: (
    notes: Partial<Note>[]
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
      if (filters?.project && filters.project !== "all") {
        params.append("project", filters.project);
      }
      if (filters?.tag && filters.tag !== "all") {
        params.append("tag", filters.tag);
      }
      if (filters?.search) {
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
      set({ notes: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  getNote: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`/api/notes/${id}`);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createNote: async (note) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post("/api/notes", note);
      set((state) => ({
        notes: [response.data, ...state.notes],
        loading: false,
      }));
      return response.data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateNote: async (id, note) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.put(`/api/notes/${id}`, note);
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? response.data : n)),
        loading: false,
      }));
      return response.data;
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
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? response.data : n)),
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
    const response = await axios.post(`/api/notes/${noteId}/share`, {
      identifiers,
      permission,
      expiresIn,
    });
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
    return response.data;
  },

  importNotes: async (notes) => {
    const response = await axios.post("/api/notes/import", { notes });
    return response.data;
  },

  fetchCollections: async () => {
    const response = await axios.get("/api/collections");
    return response.data;
  },

  createCollection: async (name: string) => {
    const response = await axios.post("/api/collections", { name });
    return response.data;
  },

  renameCollection: async (id: number, name: string) => {
    const response = await axios.put(`/api/collections/${id}`, { name });
    return response.data;
  },

  deleteCollection: async (id: number) => {
    await axios.delete(`/api/collections/${id}`);
  },

  addNotesToCollection: async (id: number, noteIds: number[]) => {
    const response = await axios.post(`/api/collections/${id}/notes`, { noteIds });
    return response.data;
  },

  removeNoteFromCollection: async (id: number, noteId: number) => {
    await axios.delete(`/api/collections/${id}/notes/${noteId}`);
  },

  availableCollectionNotes: async (id: number) => {
    const response = await axios.get(`/api/collections/${id}/available-notes`);
    return response.data;
  },

  shareCollection: async (
    id: number,
    identifiers: string[],
    permission: "view" | "edit" = "view",
    expiresIn = "never"
  ) => {
    const response = await axios.post(`/api/collections/${id}/share`, {
      identifiers,
      permission,
      expiresIn,
    });
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
    const response = await axios.post("/api/notes/bulk", {
      noteIds,
      action,
      collectionId,
    });
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
