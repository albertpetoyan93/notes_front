import { create } from "zustand";
import axios from "../configs/axios";

export interface NoteContent {
  mainContent: string;
  customFields: Array<{
    label: string;
    value: string;
  }>;
}

export interface Note {
  id: number;
  title: string;
  content: NoteContent | Record<string, any>;
  comment?: string;
  category: "note" | "password" | "login" | "command" | "ssh" | "db" | "other";
  project?: string;
  tags?: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
  isOwner?: boolean;
  isShared?: boolean;
  permission?: "owner" | "view" | "edit";
}

export interface NoteShare {
  id: number;
  noteId: number;
  sharedByUserId: number;
  sharedWithUserId: number;
  permission: "view" | "edit";
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
    search?: string;
    isFavorite?: boolean;
    sharedOnly?: boolean;
  }) => Promise<void>;
  getNote: (id: number) => Promise<Note>;
  createNote: (note: Partial<Note>) => Promise<Note>;
  updateNote: (id: number, note: Partial<Note>) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  getNoteStats: () => Promise<any>;
  getProjects: () => Promise<string[]>;
  shareNote: (
    noteId: number,
    identifier: string | string[],
    permission?: "view" | "edit"
  ) => Promise<{ shared: NoteShare[]; failed: { identifier: string; message: string }[] }>;
  getNoteShares: (noteId: number) => Promise<NoteShare[]>;
  revokeShare: (noteId: number, userId: number) => Promise<void>;
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
      if (filters?.search) {
        params.append("search", filters.search);
      }
      if (filters?.isFavorite) {
        params.append("isFavorite", "true");
      }
      if (filters?.sharedOnly) {
        params.append("sharedOnly", "true");
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

  toggleFavorite: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note || note.isOwner === false) return;

    set({ loading: true, error: null });
    try {
      const response = await axios.put(`/api/notes/${id}`, {
        isFavorite: !note.isFavorite,
      });
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? response.data : n)),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
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

  shareNote: async (noteId, identifier, permission = "view") => {
    const identifiers = Array.isArray(identifier) ? identifier : [identifier];
    const response = await axios.post(`/api/notes/${noteId}/share`, {
      identifiers,
      permission,
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

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
    get().fetchNotes({ category, search: get().searchQuery });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchNotes({ category: get().selectedCategory, search: query });
  },
}));
