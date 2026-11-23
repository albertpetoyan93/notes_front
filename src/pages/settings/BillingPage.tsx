import { BankOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Segmented, Spin, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBillingStore, type BillingCompany, type Interval } from "../../store/billingStore";
import { useVaultStore } from "../../store/vaultStore";
import AttentionList from "./billing/AttentionList";
import CompanyCard from "./billing/CompanyCard";
import ChargeDialog from "./billing/ChargeDialog";
import CurrentPlan from "./billing/CurrentPlan";
import DiscountModal from "./billing/DiscountModal";
import FamilySection from "./billing/FamilySection";
import {
  companyNeedsAttention,
  guessCurrency,
  joinNames,
  money,
  monthlyCents,
  scrollToId,
  teamNames,
} from "./billing/format";
import PaymentHistory from "./billing/PaymentHistory";
import PlanCards from "./billing/PlanCards";
import SubscribeDialog from "./billing/SubscribeDialog";
import "../company/CompanyPage.scss";
import "./BillingPage.scss";

/**
 * Billing for one account at a time, picked at the top: Personal (own plan, plans to start,
 * family, own payments) or a company they manage (its Team bill and payments). The choice
 * lives in ?for=<companyId>; without it the page opens on the vault open in the sidebar.
 */
const BillingPage = () => {
  const billing = useBillingStore((state) => state.billing);
  const load = useBillingStore((state) => state.load);
  const refreshVault = useVaultStore((state) => state.refresh);
  const vaultCompanyId = useVaultStore((state) => state.companyId);
  const [params, setParams] = useSearchParams();
  const [interval, setBillingInterval] = useState<Interval>("year");
  const [activating, setActivating] = useState(false);
  const started = useRef(false);
  const poll = useRef<number | null>(null);
  // A plan picked on the website (?plan=team&interval=month): shown and scrolled to.
  const [picked, setPicked] = useState<"premium" | "family" | "team" | null>(null);
  const [showOwnPlans, setShowOwnPlans] = useState(false);
  const [subscribeFor, setSubscribeFor] = useState<BillingCompany | null>(null);
  const [discountFor, setDiscountFor] = useState<BillingCompany | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const plan = params.get("plan");
    if (plan !== "premium" && plan !== "family" && plan !== "team") return;
    const next = params.get("interval");
    if (next === "month" || next === "year") setBillingInterval(next);
    setPicked(plan);
    if (plan !== "team") setShowOwnPlans(true);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("plan");
        next.delete("interval");
        // Premium and Family are personal plans; Team opens on a company (see `scope` below).
        if (plan !== "team") next.delete("for");
        else if (!next.get("for")) next.set("for", "team");
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  useEffect(() => {
    if (picked && billing) scrollToId(picked === "team" ? "billing-companies" : `plan-${picked}`);
  }, [picked, billing]);

  // Back from Stripe: wait for the webhook to confirm, instead of trusting the redirect.
  useEffect(() => {
    const result = params.get("checkout");
    if (!result || started.current) return;
    started.current = true;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("checkout");
        return next;
      },
      { replace: true },
    );
    if (result === "cancel") {
      message.info("Checkout cancelled. Nothing was charged.");
      return;
    }
    setActivating(true);
    let tries = 0;
    // Kept in a ref: removing ?checkout from the URL re-runs this effect, and a cleanup
    // here would stop the polling while the spinner stays on screen.
    poll.current = window.setInterval(async () => {
      tries += 1;
      const next = await load();
      const paid =
        next?.subscription?.paid ||
        next?.companies.some((company) => company.subscription?.paid && company.subscription.live);
      if (paid || tries >= 15) {
        if (poll.current) window.clearInterval(poll.current);
        poll.current = null;
        setActivating(false);
        refreshVault();
        if (paid) message.success("Payment received. Thank you!");
        else message.info("Payment received. Your plan will appear here in a moment.");
      }
    }, 2000);
  }, [params, setParams, load, refreshVault]);

  // Stop polling only when leaving the page.
  useEffect(
    () => () => {
      if (poll.current) window.clearInterval(poll.current);
    },
    [],
  );

  if (!billing) {
    return (
      <div className="manage-page billing-page">
        <div className="billing-loading">
          <Spin />
        </div>
      </div>
    );
  }

  // Whose billing is shown: ?for=<companyId>, ?for=team (the website's Team link: the open
  // company vault, else the first one owned), else the vault open in the sidebar, else Personal.
  const companies = billing.companies;
  const forParam = params.get("for");
  const known = (id: number | null | undefined) => (id != null && companies.some((c) => c.id === id) ? id : null);
  const scope: number | null =
    forParam === "team"
      ? (known(vaultCompanyId) ?? companies.find((c) => c.role === "owner")?.id ?? companies[0]?.id ?? null)
      : forParam === "me"
        ? null
        : forParam
          ? known(Number(forParam))
          : known(vaultCompanyId);
  const company = scope === null ? null : companies.find((c) => c.id === scope) || null;
  const choose = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("for", value);
        return next;
      },
      { replace: true },
    );

  // Paying for their own plan, or in a family: nothing more to buy for the personal vault.
  const ownPaid =
    (billing.source === "own" && billing.plan !== "free" && billing.subscription?.paid) || billing.source === "family";
  const covered = billing.source === "team";
  const showPlans = !ownPaid && (!covered || showOwnPlans);
  const teamPrice = `${money(monthlyCents(billing, "team", "year"))}–${money(monthlyCents(billing, "team", "month"))}`;

  return (
    <div className="manage-page billing-page">
      <div className="manage-head">
        <div>
          <h1>Billing</h1>
          <p>{company ? `${company.name}'s Team plan and payments.` : "Your plan, your family and your payments."}</p>
        </div>

        {companies.length > 0 && (
          <div className="billing-whose">
            <Segmented
              className="billing-whose-switch"
              aria-label="Billing for"
              value={scope === null ? "me" : String(scope)}
              onChange={(value) => choose(String(value))}
              options={[
                { label: "Personal", value: "me", icon: <UserOutlined /> },
                ...companies.map((c) => ({
                  value: String(c.id),
                  icon: <BankOutlined />,
                  label: (
                    <span className="billing-whose-option">
                      {c.name}
                      {companyNeedsAttention(c) && (
                        <span className="billing-whose-dot" role="img" aria-label="needs attention" />
                      )}
                    </span>
                  ),
                })),
              ]}
            />
          </div>
        )}
      </div>

      {activating && (
        <div className="billing-activating" role="status">
          <Spin size="small" /> Confirming your payment with Stripe…
        </div>
      )}

      <AttentionList billing={billing} companyId={scope} onSubscribeCompany={setSubscribeFor} />

      {company ? (
        <section
          id="billing-companies"
          className={`billing-section${picked === "team" ? " is-picked" : ""}`}
          aria-labelledby="billing-companies-title"
        >
          <div className="billing-section-head">
            <h2 id="billing-companies-title" className="billing-label">
              Team plan
            </h2>
            <span className="billing-hint">{teamPrice} per accepted member a month</span>
          </div>
          <CompanyCard
            billing={billing}
            company={company}
            onSubscribe={setSubscribeFor}
            onAskDiscount={setDiscountFor}
          />
        </section>
      ) : (
        <>
          <CurrentPlan billing={billing} />

          {showPlans && (
            <PlanCards
              billing={billing}
              interval={interval}
              onInterval={setBillingInterval}
              picked={picked}
              covered={covered}
              onHide={covered ? () => setShowOwnPlans(false) : undefined}
            />
          )}
          {!ownPaid && covered && !showOwnPlans && (
            <div className="billing-card billing-covered">
              <span>
                You already have Premium features through {joinNames(teamNames(billing))}'s Team. You don't need a plan
                of your own.
              </span>
              <Button type="link" onClick={() => setShowOwnPlans(true)}>
                Buy your own plan
              </Button>
            </div>
          )}

          <FamilySection family={billing.family} />

          {companies.length === 0 && (
            <section
              id="billing-companies"
              className={`billing-section${picked === "team" ? " is-picked" : ""}`}
              aria-labelledby="billing-companies-title"
            >
              <div className="billing-section-head">
                <h2 id="billing-companies-title" className="billing-label">
                  Companies
                </h2>
                <span className="billing-hint">
                  Each company has its own Team bill · {teamPrice} per accepted member a month
                </span>
              </div>
              <div className="billing-card billing-empty">
                You don't manage a company yet. Create one from the vault menu (top left): it gets 14 days of Team free,
                no card needed, and its plan shows up here.
              </div>
            </section>
          )}
        </>
      )}

      {/* Only the owner pays, so an admin sees the company's plan but not its payments. */}
      {billing.payments?.enabled && (!company || company.role === "owner") && (
        <PaymentHistory billing={billing} companyId={scope} />
      )}

      <p className="billing-footnote">
        {guessCurrency() === "eur"
          ? "Prices in EUR, VAT included"
          : `Prices in USD${billing.payments?.tax ? "; tax is added at checkout where it applies" : ""}`}
        . Encryption, two-factor sign-in and passkeys are on every plan.
      </p>

      <SubscribeDialog billing={billing} company={subscribeFor} onClose={() => setSubscribeFor(null)} />
      <ChargeDialog />
      <DiscountModal company={discountFor} onClose={() => setDiscountFor(null)} />
    </div>
  );
};

export default BillingPage;
