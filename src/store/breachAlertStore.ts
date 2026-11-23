import { create } from "zustand";
import type { BreachAlert } from "../utils/breachAlerts";

// The current breach alerts (worked out in the browser by hooks/useBreachAlerts), shared so the
// item list can badge affected logins without recomputing.
type BreachAlertStore = {
  alerts: BreachAlert[];
  itemIds: Set<number>;
  setAlerts: (alerts: BreachAlert[]) => void;
};

export const useBreachAlertStore = create<BreachAlertStore>()((set) => ({
  alerts: [],
  itemIds: new Set(),
  setAlerts: (alerts) =>
    set({ alerts, itemIds: new Set(alerts.flatMap((alert) => alert.items.map((item) => item.id))) }),
}));
