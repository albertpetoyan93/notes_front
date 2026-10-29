import { BankOutlined, MoreOutlined } from "@ant-design/icons";
import { Button, Dropdown, Modal, Tag } from "antd";
import { useBillingStore, type Billing, type BillingCompany } from "../../../store/billingStore";
import { exportCompanyItems } from "./companyActions";
import { date, days, daysLeft, money, plural, teamMonthly, useBusy } from "./format";

type Fact = { label: string; value: string; detail?: string };

/** One company's Team: where it stands, seats, what it costs, and what the owner can do. */
const CompanyCard = ({
  billing,
  company,
  onSubscribe,
  onAskDiscount,
}: {
  billing: Billing;
  company: BillingCompany;
  onSubscribe: (company: BillingCompany) => void;
  onAskDiscount: (company: BillingCompany) => void;
}) => {
  const { portal, setCancelled, changeInterval, startTrial } = useBillingStore();
  const { busy, run } = useBusy();
  const payments = billing.payments?.enabled;
  const owner = company.role === "owner";
  const suspended = company.status === "suspended";
  const team = company.subscription?.live ? company.subscription : null;
  const paid = !!team?.paid;
  const interval = team?.interval || "year";
  const cancelling = !!team && (team.cancelAtPeriodEnd || team.status === "canceled");
  const discounted = company.discount?.status === "approved";
  const afterDiscount = discounted ? `, after ${company.discount!.percent}% off` : "";
  const members = company.members ?? 0;
  const seats = company.billedSeats ?? Math.max(2, members);
  const seatsFact: Fact = {
    label: "Seats",
    value: plural(members, "member"),
    detail: seats > members ? `Billed for ${seats} (minimum 2)` : `Billed for ${seats} · invites are free`,
  };
  const yearlyLine = (monthly: number) => `${money(monthly)} / month`;

  let tag = { label: "No plan", color: undefined as string | undefined };
  let facts: Fact[];
  if (suspended) {
    tag = { label: "Suspended", color: "red" };
    facts = [
      { label: "Suspended", value: `Since ${date(company.suspendedAt)}`, detail: "Team ended unpaid" },
      {
        label: "Company items",
        value: "Hidden, kept",
        detail: company.markedForRemovalAt ? "May be removed: export them" : "Personal vaults aren't affected",
      },
      { label: "To reopen", value: yearlyLine(teamMonthly(billing, company, "year")), detail: `${plural(seats, "seat")}, billed yearly${afterDiscount}` },
    ];
  } else if (team && !paid && team.status === "trialing") {
    tag = { label: "Team trial", color: "purple" };
    facts = [
      { label: "Trial", value: `${days(daysLeft(team.trialEndsAt))} left`, detail: `Ends ${date(team.trialEndsAt)}` },
      seatsFact,
      {
        label: "After the trial",
        value: yearlyLine(teamMonthly(billing, company, "year")),
        detail: `Billed yearly, or ${money(teamMonthly(billing, company, "month"))} monthly${afterDiscount}`,
      },
    ];
  } else if (team && paid) {
    const monthly = teamMonthly(billing, company, interval);
    const firstPayment = team.trialEndsAt && new Date(team.trialEndsAt).getTime() > Date.now();
    tag = team.status === "past_due"
      ? { label: "Payment failed", color: "orange" }
      : { label: `Team · ${interval === "year" ? "Yearly" : "Monthly"}`, color: "green" };
    facts = [
      team.status === "past_due"
        ? { label: "Payment failed", value: `Fix by ${date(team.graceEndsAt)}`, detail: `${days(daysLeft(team.graceEndsAt))} of grace left` }
        : cancelling
          ? { label: "Ends", value: date(team.currentPeriodEnd), detail: "Cancelled; Team stays until then" }
          : firstPayment
            ? { label: "First payment", value: date(team.trialEndsAt), detail: "Subscribed during the trial" }
            : { label: "Renews", value: date(team.currentPeriodEnd), detail: "Paid through Stripe" },
      seatsFact,
      {
        label: "Cost",
        value: `${money(monthly)} / month`,
        detail: interval === "year" ? `${money(monthly * 12)} billed yearly${afterDiscount}` : `Billed monthly${afterDiscount}`,
      },
    ];
  } else {
    facts = [
      { label: "Plan", value: "None", detail: "Company collections need Team" },
      seatsFact,
      { label: "With Team", value: yearlyLine(teamMonthly(billing, company, "year")), detail: `Billed yearly${afterDiscount}` },
    ];
  }

  const other = interval === "year" ? "month" : "year";
  const cancel = () =>
    Modal.confirm({
      title: `Cancel Team for ${company.name}?`,
      content: `Team stays until ${date(team?.currentPeriodEnd || null)}. After that the company is suspended: its items are hidden but kept, and you can export them or subscribe again.`,
      okText: "Cancel Team",
      okButtonProps: { danger: true },
      cancelText: "Keep it",
      onOk: () => run("cancel", () => setCancelled(true, company.id), "Team cancelled at the end of the period"),
    });

  const menu = owner
    ? [
        ...(paid && !cancelling && team?.status !== "past_due"
          ? [{ key: "interval", label: `Switch to ${other === "year" ? "yearly" : "monthly"} (${money(teamMonthly(billing, company, other))} / month)` }]
          : []),
        ...(paid && cancelling ? [{ key: "resume", label: "Resume Team" }] : []),
        ...(paid && team?.status !== "past_due" ? [{ key: "portal", label: "Card and invoices" }] : []),
        { key: "export", label: "Export company items" },
        ...(!company.discount && !suspended ? [{ key: "discount", label: "Ask for the nonprofit or school discount" }] : []),
        ...(paid && !cancelling ? [{ key: "cancel", label: "Cancel Team", danger: true }] : []),
      ]
    : [];
  const onMenu = ({ key }: { key: string }) => {
    if (key === "interval")
      run("interval", () => changeInterval(other, company.id), other === "year" ? "Switched to yearly" : "Switched to monthly");
    if (key === "resume") run("resume", () => setCancelled(false, company.id), "Team continues");
    if (key === "portal") run("portal", () => portal(company.id));
    if (key === "export") run("export", () => exportCompanyItems(company));
    if (key === "discount") onAskDiscount(company);
    if (key === "cancel") cancel();
  };

  // One main action, by state; everything rarer is in the menu.
  let primary: { key: string; label: string; onClick: () => void } | null = null;
  if (owner) {
    if (suspended && payments) primary = { key: "reopen", label: "Subscribe and reopen", onClick: () => onSubscribe(company) };
    else if (paid && team?.status === "past_due") primary = { key: "portal", label: "Update card", onClick: () => run("portal", () => portal(company.id)) };
    else if (paid && cancelling) primary = { key: "resume", label: "Resume Team", onClick: () => run("resume", () => setCancelled(false, company.id), "Team continues") };
    else if (!paid && payments && !suspended) primary = { key: "subscribe", label: "Subscribe", onClick: () => onSubscribe(company) };
  }
  const menuItems = menu.filter((item) => item.key !== primary?.key);

  const notes: string[] = [];
  if (!owner) notes.push(`You're an admin here. Only the owner can change ${company.name}'s plan.`);
  if (company.discount?.status === "pending") notes.push(`Your ${company.discount.kind} discount request is being reviewed. We'll email you.`);

  return (
    <div className="billing-card company-card">
      <div className="company-card-head">
        <span className="company-card-icon" aria-hidden>
          <BankOutlined />
        </span>
        <div className="company-card-name">
          <strong>{company.name}</strong>
          <Tag color={tag.color}>{tag.label}</Tag>
          {discounted && (
            <Tag color="green">
              {company.discount!.percent}% off · {company.discount!.kind}
            </Tag>
          )}
        </div>
        <div className="company-card-actions">
          {owner && company.canStartTrial && !team && !suspended && (
            <Button
              loading={busy === "trial"}
              onClick={() => run("trial", () => startTrial("team", company.id), "Team is on for 14 days. Every member gets Premium.")}
            >
              Start Team trial
            </Button>
          )}
          {suspended && owner && (
            <Button loading={busy === "export"} onClick={() => run("export", () => exportCompanyItems(company))}>
              Export items
            </Button>
          )}
          {primary && (
            <Button type="primary" loading={busy === primary.key} onClick={primary.onClick}>
              {primary.label}
            </Button>
          )}
          {menuItems.filter((item) => !(suspended && item.key === "export")).length > 0 && (
            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              menu={{ items: menuItems.filter((item) => !(suspended && item.key === "export")), onClick: onMenu }}
            >
              <Button
                icon={<MoreOutlined />}
                aria-label={`More for ${company.name}`}
                loading={busy === "interval" || busy === "cancel" || (busy === "portal" && primary?.key !== "portal") || (busy === "export" && !suspended)}
              />
            </Dropdown>
          )}
        </div>
      </div>
      <dl className="company-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              <strong>{fact.value}</strong>
              {fact.detail && <span>{fact.detail}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {notes.map((note) => (
        <p key={note} className="billing-hint">
          {note}
        </p>
      ))}
    </div>
  );
};

export default CompanyCard;
