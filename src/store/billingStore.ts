import { create } from "zustand";
import { fetcherDelete, fetcherGet, fetcherPost } from "../configs/axios";
import { guessCurrency } from "../pages/settings/billing/format";

export type PlanId = "free" | "premium" | "family" | "team";

export interface PlanLimits {
  collections: number | null;
  sharePeople: number | null;
  shareExpiry: boolean;
  passwordHealth: boolean;
  emergencyAccess: boolean;
  storageBytes: number;
}

export interface BillingSubscription {
  id: number;
  plan: PlanId;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  interval: "month" | "year" | null;
  seats: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: string | null;
  /** "usd" or "eur" once paid through Stripe; null for a trial. */
  currency?: string | null;
  live: boolean;
  /** Paid through Stripe (not a free trial). */
  paid: boolean;
}

export interface BillingCompany {
  id: number;
  name: string;
  role: "owner" | "admin";
  /** Suspended: Team ended unpaid. Items hidden but kept; the owner can export. */
  status: "active" | "suspended";
  suspendedAt: string | null;
  /** Unpaid for 90 days (nothing is deleted while removal is off). */
  markedForRemovalAt: string | null;
  subscription: BillingSubscription | null;
  /** Accepted members (pending invites are free). */
  members: number;
  /** Seats Team bills for: max(2, members). */
  billedSeats: number;
  canStartTrial: boolean;
  /** 50% off Team for nonprofits and schools: approved, or waiting for review. */
  discount: {
    kind: "nonprofit" | "school";
    percent: number;
    status: "approved" | "pending";
  } | null;
}

export interface DiscountRequestInput {
  kind: "nonprofit" | "school";
  organization: string;
  website?: string;
  note?: string;
}

export interface FamilyMemberRow {
  id: number;
  email: string;
  status: "invited" | "active";
  expiresAt: string | null;
  /** Active, but can't open the family collection yet: this browser shares it. */
  needsCollection: boolean;
}

export interface FamilyInfo {
  /** The family they run (paid or on trial). */
  organizer: {
    live: boolean;
    maxMembers: number;
    members: FamilyMemberRow[];
    collection: { id: number; name: string } | null;
  } | null;
  /** The family they joined. */
  membership: { id: number; organizer: string } | null;
  invites: { id: number; organizer: string; expiresAt: string | null }[];
}

export interface Billing {
  plan: PlanId;
  planName: string;
  /** Their own subscription, a company's Team, a family they joined, or nothing. */
  source: "own" | "team" | "family" | "free";
  companyName: string | null;
  /** Live Team companies this person belongs to (may be more than one). */
  teamCompanies: { id: number; name: string }[];
  familyOrganizer: string | null;
  limits: PlanLimits;
  subscription: BillingSubscription | null;
  usage: { collections: number; storageBytes?: number };
  trials: { premium: boolean; family: boolean };
  companies: BillingCompany[];
  family: FamilyInfo;
  /** List prices in US cents per month, by billing period (yearly is billed as 12 months). */
  prices?: Record<Exclude<PlanId, "free">, { month: number; year: number }>;
  payments: {
    /** Stripe is set up on the server. */
    enabled: boolean;
    /** Tax is added at checkout. */
    tax: boolean;
    managedByStripe: boolean;
    hasBillingAccount: boolean;
  };
}

export type Interval = "month" | "year";

export interface IntervalPreview {
  amountCents: number;
  currency: string;
  /** The card that is charged; null when Stripe has none on file (then it asks at payment). */
  card: { brand: string; last4: string; wallet: string | null } | null;
  prorationDate: number;
  /** Still in the free days: nothing today; the first charge stays on this date. */
  trialEndsAt: string | null;
  /** Receipt lines, in cents: the new plan's price, credit for unused time, discount, tax. */
  priceCents: number;
  creditCents: number;
  discountCents: number;
  taxCents: number;
  /** The period the new price covers. */
  periodStart: string | null;
  periodEnd: string | null;
}

/** A failed payment to pay again: what it charges, on which card, for which period. */
export type RetryPreview = Omit<IntervalPreview, "prorationDate" | "trialEndsAt"> & { interval: Interval };

/** What the server says when a plan limit is hit (HTTP 402). */
export interface PlanLimitInfo {
  message: string;
  feature: keyof PlanLimits;
  plan: PlanId;
}

interface BillingStore {
  billing: Billing | null;
  loading: Promise<Billing | null> | null;
  upgrade: PlanLimitInfo | null;
  load: () => Promise<Billing | null>;
  /** Loads once; later calls reuse the answer. */
  ensure: () => Promise<Billing | null>;
  startTrial: (
    plan: "premium" | "family" | "team",
    companyId?: number,
  ) => Promise<void>;
  /** Go to Stripe's checkout page. */
  checkout: (
    plan: "premium" | "family" | "team",
    interval: Interval,
    companyId?: number,
  ) => Promise<void>;
  familyInvite: (email: string) => Promise<{ emailSent: boolean }>;
  familyAccept: (inviteId: number) => Promise<void>;
  familyDecline: (inviteId: number) => Promise<void>;
  familyRemove: (memberId: number) => Promise<void>;
  familyLeave: () => Promise<void>;
  /** Create the family collection (by name) or use one of their own collections. */
  familyCollection: (input: {
    name?: string;
    collectionId?: number;
  }) => Promise<{ id: number; name: string }>;
  /** The owner asks for the nonprofit or school discount. */
  requestDiscount: (
    companyId: number,
    input: DiscountRequestInput,
  ) => Promise<void>;
  /** Go to Stripe's customer portal (card, invoices). */
  portal: (companyId?: number) => Promise<void>;
  setCancelled: (cancel: boolean, companyId?: number) => Promise<void>;
  /** A failed payment: what trying again charges, and on which card. */
  previewRetry: (companyId?: number) => Promise<RetryPreview>;
  /** Charge a failed payment again now. */
  retryPayment: (companyId?: number) => Promise<void>;
  /** What switching monthly/yearly charges today, priced by Stripe before anything changes. */
  previewInterval: (interval: Interval, companyId?: number) => Promise<IntervalPreview>;
  /** prorationDate: the moment the confirmed preview was priced at. */
  changeInterval: (interval: Interval, companyId?: number, prorationDate?: number) => Promise<void>;
  /** Subscribed during a trial: end the free days and charge the card today. */
  payNow: (companyId?: number) => Promise<void>;
  openUpgrade: (info: PlanLimitInfo) => void;
  closeUpgrade: () => void;
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  billing: null,
  loading: null,
  upgrade: null,

  load: async () => {
    const request = fetcherGet("/api/billing")
      .then((billing: Billing) => {
        set({ billing, loading: null });
        return billing;
      })
      .catch(() => {
        set({ loading: null });
        return get().billing;
      });
    set({ loading: request });
    return request;
  },

  ensure: () =>
    get().loading ||
    (get().billing ? Promise.resolve(get().billing) : get().load()),

  startTrial: async (plan, companyId) => {
    await fetcherPost("/api/billing/trial", { plan, companyId });
    await get().load();
  },

  checkout: async (plan, interval, companyId) => {
    // The currency the prices were shown in; the server keeps an earlier one if there is one.
    const { url } = await fetcherPost("/api/billing/checkout", {
      plan,
      interval,
      companyId,
      currency: guessCurrency(),
    });
    window.location.assign(url);
  },

  requestDiscount: async (companyId, input) => {
    await fetcherPost(`/api/billing/companies/${companyId}/discount`, input);
    await get().load();
  },

  portal: async (companyId) => {
    const { url } = await fetcherPost("/api/billing/portal", { companyId });
    window.location.assign(url);
  },

  setCancelled: async (cancel, companyId) => {
    await fetcherPost(cancel ? "/api/billing/cancel" : "/api/billing/resume", {
      companyId,
    });
    await get().load();
  },

  previewRetry: (companyId) => fetcherPost("/api/billing/retry/preview", { companyId }),

  retryPayment: async (companyId) => {
    await fetcherPost("/api/billing/retry", { companyId });
    await get().load();
  },

  previewInterval: (interval, companyId) => fetcherPost("/api/billing/interval/preview", { interval, companyId }),

  changeInterval: async (interval, companyId, prorationDate) => {
    await fetcherPost("/api/billing/interval", { interval, companyId, prorationDate });
    await get().load();
  },

  payNow: async (companyId) => {
    await fetcherPost("/api/billing/pay-now", { companyId });
    await get().load();
  },

  familyInvite: async (email) => {
    const result = await fetcherPost("/api/billing/family/invites", { email });
    await get().load();
    return result;
  },

  familyAccept: async (inviteId) => {
    await fetcherPost(`/api/billing/family/invites/${inviteId}/accept`, {});
    await get().load();
  },

  familyDecline: async (inviteId) => {
    await fetcherPost(`/api/billing/family/invites/${inviteId}/decline`, {});
    await get().load();
  },

  familyRemove: async (memberId) => {
    await fetcherDelete(`/api/billing/family/members/${memberId}`);
    await get().load();
  },

  familyLeave: async () => {
    await fetcherPost("/api/billing/family/leave", {});
    await get().load();
  },

  familyCollection: async (input) => {
    const collection = await fetcherPost(
      "/api/billing/family/collection",
      input,
    );
    await get().load();
    return collection;
  },

  openUpgrade: (info) => set({ upgrade: info }),
  closeUpgrade: () => set({ upgrade: null }),
}));

/** A plan limit from the API: the upgrade prompt is already open, so skip the error toast. */
export const isPlanLimit = (error: unknown) =>
  (error as { code?: string } | null)?.code === "plan_limit";

/** Until the plan is known, nothing is hidden. */
export const planAllows = (feature: "shareExpiry" | "passwordHealth") => {
  const billing = useBillingStore.getState().billing;
  return billing ? billing.limits[feature] : true;
};
