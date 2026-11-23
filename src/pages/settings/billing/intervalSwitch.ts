import { create } from "zustand";
import { useBillingStore, type Interval, type IntervalPreview, type RetryPreview } from "../../../store/billingStore";

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  cartes_bancaires: "Carte Bancaire",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};
const WALLETS: Record<string, string> = { apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link" };

/** "Visa •••• 4242", or "Visa •••• 4242 (Apple Pay)"; "your card" when Stripe has none on file. */
export const cardLabel = (card: IntervalPreview["card"]) => {
  if (!card) return "your card";
  const brand = BRANDS[card.brand] || card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  const wallet = card.wallet ? WALLETS[card.wallet] : null;
  return `${brand} •••• ${card.last4}${wallet ? ` (${wallet})` : ""}`;
};

/** What the charge dialog shows and does: a plan switch or a failed payment paid again. */
export type ChargeRequest =
  | { kind: "interval"; to: Interval; planName: string; companyId?: number; preview: IntervalPreview }
  | { kind: "retry"; planName: string; companyId?: number; preview: RetryPreview };

/** The one charge dialog on the Billing page (ChargeDialog.tsx renders it). */
export const useChargeDialog = create<{
  request: ChargeRequest | null;
  open: (request: ChargeRequest) => void;
  close: () => void;
}>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

type Run = (key: string, action: () => Promise<unknown>, done?: string) => Promise<void>;

/**
 * Monthly ↔ yearly, only after the person has seen what it charges today and on which
 * card. `run` shows the button busy while Stripe prices it.
 */
export const askIntervalSwitch = (to: Interval, run: Run, companyId?: number, planName = "Premium") =>
  run("interval", async () => {
    const preview = await useBillingStore.getState().previewInterval(to, companyId);
    useChargeDialog.getState().open({ kind: "interval", to, planName, companyId, preview });
  });

/** A failed payment, charged again only after the person has seen the amount and the card. */
export const askRetryPayment = (run: Run, companyId?: number, planName = "Premium") =>
  run("retry", async () => {
    const preview = await useBillingStore.getState().previewRetry(companyId);
    useChargeDialog.getState().open({ kind: "retry", planName, companyId, preview });
  });
