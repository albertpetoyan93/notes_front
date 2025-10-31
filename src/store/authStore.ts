import { create } from "zustand";

type AuthStore = {
  me: any | null;
  loading: boolean;
  setStore: (me: any | null) => void;
};

const initialState: any = {
  me: null,
  loading: false,
};

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialState,
  setStore: (fields: Partial<AuthStore>) =>
    set((state) => ({ ...state, ...fields })),
}));
