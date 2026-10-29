import { CheckOutlined } from "@ant-design/icons";
import { Button, Segmented, Tag } from "antd";
import { useBillingStore, type Billing, type Interval } from "../../../store/billingStore";
import { useVaultStore } from "../../../store/vaultStore";
import { date, money, monthlyCents, perPeriod, useBusy } from "./format";

type Card = {
  id: "free" | "premium" | "family";
  name: string;
  features: string[];
  tag?: string;
  featured?: boolean;
  primary?: { label: string; key: string; run: () => Promise<unknown>; done?: string };
  link?: { label: string; key: string; run: () => Promise<unknown> };
  disabled?: string;
  note: string;
};

/** Free, Premium and Family side by side. The free trial is the first step; paying now is the link under it. */
const PlanCards = ({
  billing,
  interval,
  onInterval,
  picked,
  covered,
  onHide,
}: {
  billing: Billing;
  interval: Interval;
  onInterval: (interval: Interval) => void;
  picked: string | null;
  covered: boolean;
  onHide?: () => void;
}) => {
  const { startTrial, checkout } = useBillingStore();
  const refreshVault = useVaultStore((state) => state.refresh);
  const { busy, run } = useBusy();
  const payments = billing.payments?.enabled;
  const own = billing.source === "own" ? billing.subscription : null;
  const trialing = own?.live && own.status === "trialing" && !own.paid ? own.plan : null;

  const paid = (plan: "premium" | "family"): Card => {
    const monthly = monthlyCents(billing, plan, interval);
    const pay = { key: `pay-${plan}`, run: () => checkout(plan, interval) };
    const trialAvailable = billing.trials[plan];
    const base = {
      premium: {
        name: "Premium",
        features: ["Unlimited collections and sharing", "Shares that end on a date", "Password health report", "Priority email support"],
        featured: true,
      },
      family: {
        name: "Family",
        features: ["Premium for 6 private vaults", "A shared family collection", "One bill"],
      },
    }[plan];

    if (trialing === plan) {
      return {
        id: plan,
        ...base,
        tag: "On trial",
        primary: payments ? { ...pay, label: `Subscribe, pay on ${date(own?.trialEndsAt || null)}` } : undefined,
        note: payments ? "Your trial keeps running until then." : "Paid plans open soon.",
      };
    }
    if (trialAvailable) {
      return {
        id: plan,
        ...base,
        tag: plan === "premium" ? "Most popular" : undefined,
        primary: {
          key: `trial-${plan}`,
          label: "Start 14-day free trial",
          run: async () => {
            await startTrial(plan);
            refreshVault();
          },
          done: plan === "family" ? "Family is on for 14 days. Invite your family below." : "Premium is on for 14 days. No card needed.",
        },
        link: payments ? { ...pay, label: `or subscribe now, ${perPeriod(monthly, interval)}` } : undefined,
        note: plan === "family" ? "No card for the trial. Invite up to 5 people by email." : "No card for the trial. When it ends, nothing is locked.",
      };
    }
    return {
      id: plan,
      ...base,
      tag: plan === "premium" ? "Most popular" : undefined,
      primary: payments ? { ...pay, label: `Subscribe ${interval === "year" ? "yearly" : "monthly"}` } : undefined,
      disabled: payments ? undefined : "Trial used · payments open soon",
      note: billing.payments?.tax ? "Tax is added at checkout where it applies." : "Cancel any time.",
    };
  };

  const cards: Card[] = [
    ...(covered
      ? []
      : [
          {
            id: "free" as const,
            name: "Free",
            features: ["2 collections", "Share with up to 3 people", "Every security feature"],
            tag: billing.plan === "free" ? "Current" : undefined,
            note: "Nothing to pay, no time limit.",
          },
        ]),
    paid("premium"),
    paid("family"),
  ];

  const unit = (id: Card["id"]) => {
    if (id === "free") return "forever";
    const yearly = interval === "year" ? `, ${money(monthlyCents(billing, id, "year") * 12)} billed yearly` : "";
    return `/ month${yearly}`;
  };

  return (
    <section id="billing-plans" className="billing-section" aria-labelledby="billing-plans-title">
      <div className="billing-section-head">
        <h2 id="billing-plans-title" className="billing-label">
          {covered ? "A plan of your own" : "Plans"}
        </h2>
        {payments && (
          <Segmented
            value={interval}
            onChange={(value) => onInterval(value as Interval)}
            options={[
              { label: "Yearly · save up to 28%", value: "year" },
              { label: "Monthly", value: "month" },
            ]}
          />
        )}
      </div>
      {covered && (
        <p className="billing-hint">
          Optional: your vault is already covered. This starts a plan in your own name.{" "}
          {onHide && (
            <Button type="link" size="small" className="billing-inline-link" onClick={onHide}>
              Hide
            </Button>
          )}
        </p>
      )}
      <div className="plan-cards">
        {cards.map((card) => (
          <div
            key={card.id}
            id={`plan-${card.id}`}
            className={`plan-card${card.featured ? " is-featured" : ""}${picked === card.id ? " is-picked" : ""}`}
          >
            <div className="plan-card-head">
              <strong>{card.name}</strong>
              {card.tag && <Tag color={card.tag === "Current" ? undefined : "purple"}>{card.tag}</Tag>}
            </div>
            <div className="plan-price">
              <b>{card.id === "free" ? "$0" : money(monthlyCents(billing, card.id, interval))}</b>
              <span>{unit(card.id)}</span>
            </div>
            <ul>
              {card.features.map((feature) => (
                <li key={feature}>
                  <CheckOutlined aria-hidden /> {feature}
                </li>
              ))}
            </ul>
            {(card.primary || card.link || card.disabled) && (
              <div className="plan-card-actions">
                {card.primary && (
                  <Button
                    type="primary"
                    block
                    loading={busy === card.primary.key}
                    onClick={() => run(card.primary!.key, card.primary!.run, card.primary!.done)}
                  >
                    {card.primary.label}
                  </Button>
                )}
                {card.link && (
                  <Button type="link" block size="small" loading={busy === card.link.key} onClick={() => run(card.link!.key, card.link!.run)}>
                    {card.link.label}
                  </Button>
                )}
                {card.disabled && (
                  <Button block disabled>
                    {card.disabled}
                  </Button>
                )}
              </div>
            )}
            <p className="plan-card-note">{card.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PlanCards;
