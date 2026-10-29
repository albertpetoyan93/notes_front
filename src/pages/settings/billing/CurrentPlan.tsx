import { CheckOutlined, DownOutlined, MinusOutlined } from "@ant-design/icons";
import { Button, Dropdown, Modal, Tag } from "antd";
import { useBillingStore, type Billing } from "../../../store/billingStore";
import { useVaultStore } from "../../../store/vaultStore";
import { date, days, daysLeft, joinNames, monthlyCents, perPeriod, scrollToId, teamNames, useBusy, type PaidPlan } from "./format";

/** The plan this person has now: what it costs, when it renews, and what it unlocks. */
const CurrentPlan = ({ billing }: { billing: Billing }) => {
  const { portal, setCancelled, changeInterval, familyLeave } = useBillingStore();
  const refreshVault = useVaultStore((state) => state.refresh);
  const { busy, run } = useBusy();
  const payments = billing.payments?.enabled;
  const own = billing.source === "own" ? billing.subscription : null;
  const live = own?.live ? own : null;
  const paidPlan = billing.plan === "free" || billing.plan === "team" ? null : (billing.plan as PaidPlan);
  const interval = live?.interval || "year";
  const cost = paidPlan ? perPeriod(monthlyCents(billing, paidPlan, interval), interval) : "";

  let name = billing.planName;
  let badge = "Current plan";
  let badgeColor: string | undefined;
  let line = "Free for as long as you like";
  let sub = "Every security feature is included. Try Premium or Family free for 14 days below.";

  if (billing.source === "team") {
    const teams = teamNames(billing);
    name = "Premium features";
    badge = teams.length > 1 ? "Through your companies" : `Through ${joinNames(teams)}`;
    badgeColor = "purple";
    line = teams.length > 1 ? `Team plans of ${joinNames(teams)} cover your vault` : `${joinNames(teams)}'s Team covers your vault`;
    sub = "You don't pay for a personal plan. If you leave, you move to Free and nothing is locked.";
  } else if (billing.source === "family") {
    const organizer = billing.familyOrganizer || "Your organizer";
    name = "Premium features";
    badge = "Through Family";
    badgeColor = "purple";
    line = `${organizer}'s Family covers your vault`;
    sub = "Your items stay private unless you put them in the family collection.";
  } else if (live) {
    if (live.status === "past_due") {
      badge = "Payment failed";
      badgeColor = "orange";
      line = `${cost} · payment failed`;
      sub = `Update your card by ${date(live.graceEndsAt)}. Nothing is locked meanwhile.`;
    } else if (live.status === "trialing" && !live.paid) {
      badge = `Trial · ${days(daysLeft(live.trialEndsAt))} left`;
      badgeColor = "purple";
      line = `Free until ${date(live.trialEndsAt)}`;
      sub = paidPlan
        ? `Then ${perPeriod(monthlyCents(billing, paidPlan, "year"), "year")} or ${perPeriod(monthlyCents(billing, paidPlan, "month"), "month")}, if you subscribe. Nothing is charged.`
        : "Nothing is charged.";
    } else if (live.cancelAtPeriodEnd || live.status === "canceled") {
      badge = "Cancelled";
      line = `Paid features stay until ${date(live.currentPeriodEnd)}`;
      sub = "After that you move to Free. Nothing is deleted.";
    } else {
      badge = interval === "year" ? "Yearly" : "Monthly";
      badgeColor = "green";
      line = live.trialEndsAt && new Date(live.trialEndsAt).getTime() > Date.now()
        ? `${cost} · first payment ${date(live.trialEndsAt)}`
        : `${cost} · renews ${date(live.currentPeriodEnd)}`;
      sub = "Paid through Stripe. Your card and invoices are under Manage.";
    }
  }

  const paid = !!live?.paid;
  const cancelling = !!live && (live.cancelAtPeriodEnd || live.status === "canceled");
  const other = interval === "year" ? "month" : "year";
  const cancel = () =>
    Modal.confirm({
      title: "Cancel your plan?",
      content: `Paid features stay until ${date(live?.currentPeriodEnd || null)}. After that the account moves to Free; nothing is deleted.`,
      okText: "Cancel plan",
      okButtonProps: { danger: true },
      cancelText: "Keep it",
      onOk: () => run("cancel", () => setCancelled(true), "Cancelled at the end of the period"),
    });
  const leave = () =>
    Modal.confirm({
      title: "Leave this family?",
      content: "Your vault stays yours. You lose the family collection and move to the Free plan.",
      okText: "Leave",
      okButtonProps: { danger: true },
      onOk: () =>
        run(
          "leave",
          async () => {
            await familyLeave();
            refreshVault();
          },
          "You left the family"
        ),
    });

  const menu = [
    { key: "portal", label: "Card and invoices" },
    ...(!cancelling && live?.status !== "past_due" && paidPlan
      ? [{ key: "interval", label: `Switch to ${other === "year" ? "yearly" : "monthly"} (${perPeriod(monthlyCents(billing, paidPlan, other), other)})` }]
      : []),
    cancelling ? { key: "resume", label: "Resume plan" } : { key: "cancel", label: "Cancel plan", danger: true },
  ];
  const onMenu = ({ key }: { key: string }) => {
    if (key === "portal") run("portal", () => portal());
    if (key === "interval") run("interval", () => changeInterval(other), other === "year" ? "Switched to yearly" : "Switched to monthly");
    if (key === "resume") run("resume", () => setCancelled(false), "Your plan continues");
    if (key === "cancel") cancel();
  };

  const { limits, usage } = billing;
  const features = [
    {
      label: limits.collections === null ? "Unlimited collections" : `Collections: ${usage.collections} of ${limits.collections} used`,
      on: true,
      meter: limits.collections === null ? null : Math.min(100, (usage.collections / limits.collections) * 100),
    },
    { label: limits.sharePeople === null ? "Unlimited sharing" : `Share with up to ${limits.sharePeople} people`, on: true },
    { label: "Share end dates", on: limits.shareExpiry },
    { label: "Password health", on: limits.passwordHealth },
  ];

  return (
    <section className="billing-section" aria-labelledby="billing-plan">
      <h2 id="billing-plan" className="billing-label">
        Your plan
      </h2>
      <div className="billing-card billing-plan">
        <div className="billing-plan-head">
          <div className="billing-plan-text">
            <div className="billing-plan-name">
              <strong>{name}</strong>
              <Tag color={badgeColor}>{badge}</Tag>
            </div>
            <span className="billing-plan-line">{line}</span>
            <span className="billing-plan-sub">{sub}</span>
          </div>
          <div className="billing-plan-actions">
            {live?.status === "past_due" && paid && (
              <Button type="primary" loading={busy === "portal"} onClick={() => run("portal", () => portal())}>
                Update card
              </Button>
            )}
            {live?.status === "trialing" && !paid && payments && (
              <Button type="primary" onClick={() => scrollToId("billing-plans")}>
                Subscribe
              </Button>
            )}
            {paid && (
              <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: menu, onClick: onMenu }}>
                <Button loading={busy === "interval" || busy === "resume" || busy === "cancel" || (busy === "portal" && live?.status !== "past_due")}>
                  Manage <DownOutlined />
                </Button>
              </Dropdown>
            )}
            {billing.source === "family" && billing.family.membership && (
              <Button danger type="text" loading={busy === "leave"} onClick={leave}>
                Leave family
              </Button>
            )}
          </div>
        </div>
        <ul className="billing-features">
          {features.map((feature) => (
            <li key={feature.label} className={feature.on ? "" : "is-off"}>
              <span className="billing-feature-line">
                {feature.on ? <CheckOutlined aria-label="Included" /> : <MinusOutlined aria-label="Not included" />}
                {feature.label}
              </span>
              {feature.meter != null && (
                <span className="billing-meter" role="img" aria-label={feature.label}>
                  <span style={{ width: `${feature.meter}%` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default CurrentPlan;
