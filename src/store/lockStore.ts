import { create } from "zustand";

// Whether this tab shows the lock screen. The server holds the real lock.
type LockStore = {
  locked: boolean;
  setLocked: (locked: boolean) => void;
};

export const useLockStore = create<LockStore>()((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));
