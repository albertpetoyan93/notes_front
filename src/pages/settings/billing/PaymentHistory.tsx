import { Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { fetcherGet } from "../../../configs/axios";
import type { Billing } from "../../../store/billingStore";
import { date, money, type Currency } from "./format";

export interface PaymentItem {
  id: number;
  paidAt: string;
  status: "paid" | "refunded" | "partially_refunded" | "failed";
  plan: string | null;
  interval: string | null;
  currency: string;
  amountCents: number;
  refundedCents: number;
  promoCode: string | null;
  invoiceNumber: string | null;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

const PLAN_NAMES: Record<string, string> = { premium: "Premium", family: "Family", team: "Team" };

const STATUS: Record<PaymentItem["status"], { label: string; color?: string }> = {
  paid: { label: "Paid", color: "green" },
  refunded: { label: "Refunded" },
  partially_refunded: { label: "Partly refunded", color: "gold" },
  failed: { label: "Failed", color: "red" },
};

const currencyOf = (code: string): Currency => (code === "eur" ? "eur" : "usd");

/** "Premium · monthly" */
const what = (p: PaymentItem) =>
  [p.plan ? PLAN_NAMES[p.plan] || p.plan : "2keevo", p.interval === "year" ? "yearly" : p.interval === "month" ? "monthly" : null]
    .filter(Boolean)
    .join(" · ");

/**
 * Payment history: the person's own payments (`companyId` null), or those of a company they own.
 * Each row links to Stripe's invoice PDF. Billing's switcher at the top picks whose.
 */
const PaymentHistory = ({ billing, companyId }: { billing: Billing; companyId: number | null }) => {
  const [rows, setRows] = useState<PaymentItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Loads again when the plan changes (a payment taken now, a renewal), not on every refresh.
  const sub =
    companyId === null ? billing.subscription : billing.companies.find((company) => company.id === companyId)?.subscription;
  const stamp = sub ? `${sub.status}|${sub.trialEndsAt}|${sub.currentPeriodEnd}` : "";

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setFailed(false);
    const query = companyId === null ? "" : `?companyId=${companyId}`;
    fetcherGet(`/api/billing/payments${query}`)
      .then((data: PaymentItem[]) => !cancelled && setRows(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [companyId, stamp]);

  return (
    <section id="billing-payments" className="billing-section" aria-labelledby="billing-payments-title">
      <div className="billing-section-head">
        <h2 id="billing-payments-title" className="billing-label">
          Payment history
        </h2>
      </div>

      {failed ? (
        <p className="billing-hint">Couldn't load payments. Try again in a moment.</p>
      ) : !rows ? (
        <Spin size="small" />
      ) : rows.length === 0 ? (
        <p className="billing-hint">No payments yet.</p>
      ) : (
        <ul className="payment-list">
          {rows.map((p) => {
            const status = STATUS[p.status] || { label: p.status };
            const currency = currencyOf(p.currency);
            return (
              <li key={p.id} className="payment-row">
                <div className="payment-main">
                  <span className="payment-date">{date(p.paidAt)}</span>
                  <span className="payment-what">
                    {what(p)}
                    {p.periodStart && p.periodEnd && (
                      <span className="payment-period">
                        {" "}
                        · {date(p.periodStart)} – {date(p.periodEnd)}
                      </span>
                    )}
                    {p.promoCode && <span className="payment-period"> · code {p.promoCode}</span>}
                  </span>
                </div>
                <div className="payment-side">
                  <span className="payment-amount">
                    {money(p.amountCents, currency)}
                    {p.refundedCents > 0 && p.status !== "refunded" && (
                      <span className="payment-period"> ({money(p.refundedCents, currency)} refunded)</span>
                    )}
                  </span>
                  <Tag color={status.color}>{status.label}</Tag>
                  {p.invoicePdf ? (
                    <a href={p.invoicePdf} target="_blank" rel="noreferrer" className="payment-invoice">
                      Invoice PDF
                    </a>
                  ) : p.hostedInvoiceUrl ? (
                    <a href={p.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="payment-invoice">
                      Invoice
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default PaymentHistory;
