import { CreditCardOutlined, ReloadOutlined, SwapOutlined } from "@ant-design/icons";
import { Alert, Button, Modal, message } from "antd";
import { useState } from "react";
import { useBillingStore } from "../../../store/billingStore";
import { date, money as formatMoney, type Currency } from "./format";
import { cardLabel, useChargeDialog } from "./intervalSwitch";

type Row = { label: string; detail?: string; cents: number; minus?: boolean };

const period = (start: string | null, end: string | null) => (start && end ? `${date(start)} – ${date(end)}` : undefined);

/**
 * Confirm before money moves: switching monthly ↔ yearly, or paying a failed payment again.
 * A receipt (new price, credit for unused time, discount), the total due today, the card it
 * goes on, and when the plan renews. Amounts come from Stripe's own preview.
 */
const ChargeDialog = () => {
  const { request, close } = useChargeDialog();
  const { changeInterval, retryPayment, portal } = useBillingStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!request) return null;
  const { preview } = request;
  const money = (cents: number) => formatMoney(cents, preview.currency as Currency);
  const interval = request.kind === "interval" ? request.to : request.preview.interval;
  const yearly = interval === "year";
  const trialEndsAt = request.kind === "interval" ? request.preview.trialEndsAt : null;
  const due = preview.amountCents;
  // Moving to monthly can leave more credit than the first month costs: it stays for later.
  const leftover = Math.max(0, preview.creditCents + preview.discountCents - preview.priceCents);

  const rows: Row[] = [];
  if (preview.priceCents > 0) {
    rows.push({
      label: `${request.planName}, ${yearly ? "yearly" : "monthly"}`,
      detail: period(preview.periodStart, preview.periodEnd),
      cents: preview.priceCents,
    });
  }
  if (preview.creditCents > 0) {
    rows.push({
      label: request.kind === "interval" ? `Unused time on your ${yearly ? "monthly" : "yearly"} plan` : "Credit",
      cents: preview.creditCents,
      minus: true,
    });
  }
  if (preview.discountCents > 0) rows.push({ label: "Discount", cents: preview.discountCents, minus: true });

  const title =
    request.kind === "retry" ? "Pay the failed payment" : yearly ? "Switch to yearly billing" : "Switch to monthly billing";
  const subtitle =
    request.kind === "retry"
      ? "Your last payment didn't go through. Nothing is locked yet."
      : yearly
        ? `${request.planName} · billed once a year`
        : `${request.planName} · billed every month`;

  let note: string;
  if (trialEndsAt) {
    note = `Nothing is charged during your free days. The first payment is on ${date(trialEndsAt)}.`;
  } else if (request.kind === "retry") {
    note = "If this card no longer works, change it first. The payment then goes on the new card.";
  } else if (leftover > 0) {
    note = `The remaining ${money(leftover)} of credit is used for your next payments.`;
  } else {
    note = `Renews ${preview.periodEnd ? `on ${date(preview.periodEnd)}` : "automatically"}. You can cancel anytime from Manage.`;
  }

  const confirmLabel = due > 0 ? `Pay ${money(due)}` : "Switch";
  const cancelLabel = request.kind === "retry" ? "Not now" : yearly ? "Keep monthly" : "Keep yearly";

  const finish = () => {
    setError("");
    setBusy(false);
    close();
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      if (request.kind === "retry") {
        await retryPayment(request.companyId);
        message.success("Paid. Thank you!");
      } else {
        await changeInterval(request.to, request.companyId, request.preview.prorationDate);
        message.success(yearly ? "You're on yearly billing now" : "You're on monthly billing now");
      }
      finish();
    } catch (err: any) {
      // Stay open: the reason (a declined card…) belongs next to the button that failed.
      setError(err?.message || "Something went wrong. Nothing was charged.");
      setBusy(false);
    }
  };

  const changeCard = async () => {
    setBusy(true);
    try {
      await portal(request.companyId);
    } catch (err: any) {
      setError(err?.message || "Could not open your card settings.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      centered
      width={440}
      footer={null}
      onCancel={() => !busy && finish()}
      maskClosable={!busy}
      className="charge-dialog"
      destroyOnClose
    >
      <div className="charge-head">
        <span className={`charge-icon${request.kind === "retry" ? " is-warn" : ""}`} aria-hidden>
          {request.kind === "retry" ? <ReloadOutlined /> : <SwapOutlined />}
        </span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="charge-receipt">
        {rows.map((row) => (
          <div className="charge-row" key={row.label}>
            <div>
              <span>{row.label}</span>
              {row.detail && <small>{row.detail}</small>}
            </div>
            <span className={row.minus ? "is-minus" : ""}>
              {row.minus ? "−" : ""}
              {money(row.cents)}
            </span>
          </div>
        ))}
        <div className="charge-total">
          <span>{request.kind === "retry" ? "Due now" : "Due today"}</span>
          <strong>{money(due)}</strong>
        </div>
        {preview.taxCents > 0 && <small className="charge-tax">Includes {money(preview.taxCents)} VAT</small>}
      </div>

      {(due > 0 || trialEndsAt) && (
        <div className="charge-card">
          <CreditCardOutlined aria-hidden />
          <span>{cardLabel(preview.card)}</span>
          <Button type="link" size="small" onClick={changeCard} disabled={busy}>
            Change
          </Button>
        </div>
      )}

      <p className="charge-note">{note}</p>

      {error && <Alert type="error" showIcon message={error} className="charge-error" />}

      <div className="charge-actions">
        <Button onClick={finish} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button type="primary" onClick={confirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};

export default ChargeDialog;
