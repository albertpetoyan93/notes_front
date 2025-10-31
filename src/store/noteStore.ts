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
  content: NoteContent | Record<string, any>; // JSONB object
  comment?: string;
  category: "note" | "password" | "login" | "command" | "ssh" | "db" | "other";
  project?: string;
  tags?: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface NoteStore {
  notes: Note[];
  loading: boolean;
  error: string | null;
  selectedCategory: string;
  searchQuery: string;
  projects: string[];

  // Actions
  fetchNotes: (filters?: {
    category?: string;
    project?: string;
    search?: string;
    isFavorite?: boolean;
  }) => Promise<void>;
  getNote: (id: number) => Promise<Note>;
  createNote: (note: Partial<Note>) => Promise<Note>;
  updateNote: (id: number, note: Partial<Note>) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  getNoteStats: () => Promise<any>;
  getProjects: () => Promise<string[]>;
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
      await get().fetchNotes();
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
      await get().fetchNotes();
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
    if (!note) return;

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

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
    get().fetchNotes({ category, search: get().searchQuery });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchNotes({ category: get().selectedCategory, search: query });
  },
}));
