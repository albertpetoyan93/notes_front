import { message } from "antd";
import { useState } from "react";
import type { Billing, BillingCompany, Interval } from "../../../store/billingStore";
import dayjsExtra from "../../../utils/dayjs";

export type PaidPlan = "premium" | "family" | "team";

// The server sends its list prices; these match them for an older server.
const FALLBACK_PRICES: Record<PaidPlan, { month: number; year: number }> = {
  premium: { month: 349, year: 250 },
  family: { month: 599, year: 450 },
  team: { month: 500, year: 400 },
};

/** Price in cents per month, for that billing period (the same number in USD and EUR). */
export const monthlyCents = (billing: Billing, plan: PaidPlan, interval: Interval) =>
  (billing.prices || FALLBACK_PRICES)[plan][interval];

/** USD: tax added on top where it applies. EUR: VAT included. */
export type Currency = "usd" | "eur";

/**
 * The currency to show before anything is paid: EUR in Europe, USD elsewhere. Stripe
 * checkout is opened in the same one. Once paid, the subscription's own currency wins.
 */
export const guessCurrency = (): Currency => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone?.startsWith("Europe/") ? "eur" : "usd";
  } catch {
    return "usd";
  }
};

/** A paid subscription's currency, else the guess. */
export const currencyOf = (subscription?: { currency?: string | null } | null): Currency =>
  subscription?.currency === "eur" || subscription?.currency === "usd" ? subscription.currency : guessCurrency();

export const money = (cents: number, currency: Currency = guessCurrency()) => {
  const value = Math.round(cents) / 100;
  const symbol = currency === "eur" ? "€" : "$";
  return value % 1 === 0 ? `${symbol}${value}` : `${symbol}${value.toFixed(2)}`;
};

/** "$30 a year" or "€3.49 a month". */
export const perPeriod = (monthly: number, interval: Interval, currency: Currency = guessCurrency()) =>
  interval === "year" ? `${money(monthly * 12, currency)} a year` : `${money(monthly, currency)} a month`;

/** What the price includes, in that currency. */
export const taxNote = (currency: Currency = guessCurrency()) =>
  currency === "eur" ? "Prices include VAT." : "Tax is added at checkout where it applies.";

export const date = (value: string | null) => (value ? dayjsExtra(value).format("D MMM YYYY") : "");
export const shortDate = (value: string | null) => (value ? dayjsExtra(value).format("D MMM") : "");

export const daysLeft = (value: string | null) =>
  value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) : 0;

export const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const joinNames = (names: string[]) => {
  if (names.length <= 1) return names[0] || "your company";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

/** Live Team companies that cover this person's vault. */
export const teamNames = (billing: Billing) => {
  const names = (billing.teamCompanies || []).map((company) => company.name).filter(Boolean);
  if (names.length) return names;
  return (billing.companyName || "").split(",").map((name) => name.trim()).filter(Boolean);
};

/** What a company's Team costs a month for its billed seats, after an approved discount. */
export const teamMonthly = (billing: Billing, company: BillingCompany, interval: Interval) => {
  const seats = company.billedSeats ?? Math.max(2, company.members ?? 0);
  const off = company.discount?.status === "approved" ? company.discount.percent : 0;
  return (monthlyCents(billing, "team", interval) * seats * (100 - off)) / 100;
};

/** Run a button's action with a spinner and a toast. Checkout keeps spinning while the page leaves. */
export const useBusy = () => {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await action();
      if (done) message.success(done);
      if (!key.startsWith("pay")) setBusy(null);
    } catch (error: any) {
      message.error(error?.message || "Something went wrong");
      setBusy(null);
    }
  };
  return { busy, run };
};

export const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

/** A trial ending within this many days is flagged. */
export const SOON_DAYS = 3;
/** Free access from the 2keevo team ending within this many days is flagged (the email goes out then too). */
export const FREE_SOON_DAYS = 7;

/** Free access from the 2keevo team that is still on. */
export const isComplimentary = (subscription: { status: string; live: boolean } | null | undefined) =>
  !!subscription?.live && subscription.status === "complimentary";

/** True when a company the person owns has something to fix: suspended, a failed payment or a trial ending soon. */
export const companyNeedsAttention = (company: BillingCompany) => {
  if (company.role !== "owner") return false;
  const team = company.subscription?.live ? company.subscription : null;
  return (
    company.status === "suspended" ||
    team?.status === "past_due" ||
    (team?.status === "trialing" && !team.paid && daysLeft(team.trialEndsAt) <= SOON_DAYS) ||
    (isComplimentary(team) && daysLeft(team!.currentPeriodEnd) <= FREE_SOON_DAYS)
  );
};
