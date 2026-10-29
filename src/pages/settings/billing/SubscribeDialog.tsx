import { Modal, message } from "antd";
import { useEffect, useState } from "react";
import { useBillingStore, type Billing, type BillingCompany, type Interval } from "../../../store/billingStore";
import { date, daysLeft, money, monthlyCents, plural, teamMonthly } from "./format";

/** Subscribe a company to Team: monthly or yearly, with the exact total for its seats. */
const SubscribeDialog = ({
  billing,
  company,
  onClose,
}: {
  billing: Billing;
  company: BillingCompany | null;
  onClose: () => void;
}) => {
  const checkout = useBillingStore((state) => state.checkout);
  const [interval, setChoice] = useState<Interval>("year");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) setChoice((company.subscription?.interval as Interval | null) || "year");
  }, [company]);

  if (!company) return null;
  const members = company.members ?? 0;
  const seats = company.billedSeats ?? Math.max(2, members);
  const suspended = company.status === "suspended";
  const trial = company.subscription?.live && company.subscription.status === "trialing" ? company.subscription : null;
  const discount = company.discount?.status === "approved" ? company.discount.percent : 0;

  const options = (["year", "month"] as Interval[]).map((value) => {
    const monthly = teamMonthly(billing, company, value);
    return {
      value,
      label: value === "year" ? "Yearly" : "Monthly",
      detail: `${money(monthlyCents(billing, "team", value))} per member a month${discount ? `, ${discount}% off` : ""}`,
      total: value === "year" ? `${money(monthly * 12)} / year` : `${money(monthly)} / month`,
    };
  });

  const go = async () => {
    setSaving(true);
    try {
      await checkout("team", interval, company.id);
    } catch (error: any) {
      message.error(error?.message || "Could not open checkout");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={suspended ? `Reopen ${company.name}` : `Subscribe ${company.name} to Team`}
      okText="Continue to payment"
      confirmLoading={saving}
      onOk={go}
      onCancel={onClose}
      destroyOnClose
    >
      <div className="billing-dialog">
        <p className="billing-hint">
          {plural(members, "accepted member")}, billed for {plural(seats, "seat")}. Seats follow membership; pending invites are free.
        </p>
        <div role="radiogroup" aria-label="Billing period" className="billing-options">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={interval === option.value}
              className={`billing-option${interval === option.value ? " is-checked" : ""}`}
              onClick={() => setChoice(option.value)}
            >
              <span>
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </span>
              <b>{option.total}</b>
            </button>
          ))}
        </div>
        <p className="billing-hint">
          {suspended
            ? "The company reopens as soon as the payment goes through, with every item in place."
            : trial?.trialEndsAt && daysLeft(trial.trialEndsAt) > 2
              ? `Nothing is charged until the trial ends on ${date(trial.trialEndsAt)}. Members added later are charged for the rest of the period.`
              : "Members added later are charged for the rest of the period."}
          {billing.payments?.tax ? " Tax is added at checkout where it applies." : ""}
        </p>
      </div>
    </Modal>
  );
};

export default SubscribeDialog;
