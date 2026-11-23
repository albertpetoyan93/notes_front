import { Modal } from "antd";
import { useBillingStore, type Interval, type IntervalPreview } from "../../../store/billingStore";
import { date, money, type Currency } from "./format";

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

/** What the confirmation says about today's charge, from Stripe's preview. */
export const intervalChargeText = (to: Interval, preview: IntervalPreview) => {
  const card = cardLabel(preview.card);
  if (preview.trialEndsAt) {
    return `Nothing is charged today. Your first payment on ${date(preview.trialEndsAt)} is the ${to === "year" ? "yearly" : "monthly"} price, charged to ${card}.`;
  }
  if (preview.amountCents > 0) {
    const amount = money(preview.amountCents, preview.currency as Currency);
    return to === "year"
      ? `${amount} is charged to ${card} today: the yearly price, less the unused part of your current month and any discount. Your plan then renews once a year. To use another card, choose Card and invoices first.`
      : `${amount} is charged to ${card} today, less the unused part of your current period.`;
  }
  return to === "month"
    ? "Nothing is charged today. The unused part of your year is kept as credit and used for your next monthly payments."
    : "Nothing is charged today: your credit covers it.";
};

type Run = (key: string, action: () => Promise<unknown>, done?: string) => Promise<void>;

/** A failed payment, charged again only after the person has seen the amount and the card. */
export const askRetryPayment = (run: Run, companyId?: number) =>
  run("retry", async () => {
    const { previewRetry, retryPayment } = useBillingStore.getState();
    const preview = await previewRetry(companyId);
    const amount = money(preview.amountCents, preview.currency as Currency);
    Modal.confirm({
      title: "Try the payment again?",
      content: `${amount} is charged to ${cardLabel(preview.card)} now. If this card no longer works, choose Update card instead and add another one; it's then charged there.`,
      okText: `Pay ${amount}`,
      cancelText: "Not now",
      onOk: () => run("retry", () => retryPayment(companyId), "Paid. Thank you!"),
    });
  });

/**
 * Monthly ↔ yearly, only after the person has seen what it charges today. `run` is the
 * page's busy/message helper; the price comes from Stripe, so it matches the real charge.
 */
export const askIntervalSwitch = (to: Interval, run: Run, companyId?: number) =>
  run("interval", async () => {
    const { previewInterval, changeInterval } = useBillingStore.getState();
    const preview = await previewInterval(to, companyId);
    const charge = preview.amountCents > 0 && !preview.trialEndsAt;
    Modal.confirm({
      title: to === "year" ? "Switch to yearly billing?" : "Switch to monthly billing?",
      content: intervalChargeText(to, preview),
      okText: charge ? `Pay ${money(preview.amountCents, preview.currency as Currency)} and switch` : "Switch",
      cancelText: "Keep current",
      onOk: () =>
        run(
          "interval",
          () => changeInterval(to, companyId, preview.prorationDate),
          to === "year" ? "Switched to yearly" : "Switched to monthly"
        ),
    });
  });
