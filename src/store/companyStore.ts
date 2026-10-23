import { create } from "zustand";
import axios from "../configs/axios";

export interface CompanySummary {
  id: number;
  name: string;
  status: "active" | "suspended";
  role: "owner" | "admin" | "member";
  memberStatus: "invited" | "active" | "removed";
  /** Security rules set by the company's owners and admins. */
  policies?: CompanyPolicies;
  /** Set when the company's rules keep its items closed to you (no 2FA). */
  blocked?: "2fa" | null;
}

export interface CompanyPolicies {
  require2fa?: boolean;
  minPasswordLength?: number | null;
  maxSessionDays?: number | null;
  maxIdleMinutes?: number | null;
}

interface CompanyStore {
  companies: CompanySummary[];
  loaded: boolean;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
  load: () => Promise<void>;
}

export const useCompanyStore = create<CompanyStore>((set) => ({
  companies: [],
  loaded: false,
  inviteOpen: false,
  setInviteOpen: (open) => set({ inviteOpen: open }),
  load: async () => {
    try {
      const response = await axios.get("/api/companies");
      set({ companies: response.data || [], loaded: true });
    } catch {
      set({ companies: [], loaded: true });
    }
  },
}));
