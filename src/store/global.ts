import { create } from "zustand";

type SearchStore = {
  page: number;
  pageSize: number;
  sortKey: string;
  order: string;
  filters: any;
  setSearchStore: (params: {
    page: number;
    pageSize: number;
    sortKey: string;
    order: string;
    filters: any;
  }) => void;
  reset: () => void;
};

const initialState: any = {
  page: 1,
  pageSize: 10,
  sortKey: "",
  order: "",
  filters: {},
};

export const useSearchStore = create<SearchStore>()((set) => ({
  ...initialState,
  setSearchStore: ({ page, pageSize, sortKey, order, filters }: any) =>
    set(() => ({ page, pageSize, sortKey, order, filters })),
  reset: () => {
    set(initialState);
  },
}));
