import { create } from "zustand";
import axios from "../configs/axios";
import type { CollectionItem, Note } from "./noteStore";

// Everything the shell needs about the open vault (personal or one company):
// an unfiltered list of its notes for counts, Security health and the command
// palette, plus its collections. The notes page keeps its own filtered list.
interface VaultStore {
  companyId: number | null;
  summary: Note[];
  collections: CollectionItem[];
  loaded: boolean;
  // Bumped when something outside the notes page (sidebar, palette) changes
  // notes, so the page refetches its list.
  listVersion: number;
  // The "Import from another password manager" dialog, opened from the sidebar or the palette.
  importOpen: boolean;
  setImportOpen: (open: boolean) => void;
  // "Import from Google Authenticator" dialog.
  authenticatorImportOpen: boolean;
  setAuthenticatorImportOpen: (open: boolean) => void;
  setScope: (companyId: number | null) => void;
  refresh: () => Promise<void>;
  bumpList: () => void;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  companyId: null,
  summary: [],
  collections: [],
  loaded: false,
  listVersion: 0,
  importOpen: false,

  setImportOpen: (importOpen) => set({ importOpen }),
  authenticatorImportOpen: false,
  setAuthenticatorImportOpen: (authenticatorImportOpen) => set({ authenticatorImportOpen }),

  setScope: (companyId) => {
    if (get().companyId === companyId && get().loaded) return;
    set({ companyId, summary: [], collections: [], loaded: false });
    get().refresh();
  },

  refresh: async () => {
    const companyId = get().companyId;
    try {
      const [notes, collections] = await Promise.all([
        axios.get(companyId ? `/api/notes?company=${companyId}` : "/api/notes"),
        axios.get(
          companyId ? `/api/companies/${companyId}/collections` : "/api/collections"
        ),
      ]);
      // A slower response for a vault the user already left is dropped.
      if (get().companyId !== companyId) return;
      set({
        summary: notes.data || [],
        collections: (collections.data || []).map((collection: CollectionItem) =>
          companyId
            ? { ...collection, isOwner: collection.permission === "owner" }
            : collection
        ),
        loaded: true,
      });
    } catch {
      if (get().companyId === companyId) set({ loaded: true });
    }
  },

  bumpList: () => set((state) => ({ listVersion: state.listVersion + 1 })),
}));
