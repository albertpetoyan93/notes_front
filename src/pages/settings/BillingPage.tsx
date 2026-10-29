import { Button, Spin, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBillingStore, type BillingCompany, type Interval } from "../../store/billingStore";
import { useVaultStore } from "../../store/vaultStore";
import AttentionList from "./billing/AttentionList";
import CompanyCard from "./billing/CompanyCard";
import CurrentPlan from "./billing/CurrentPlan";
import DiscountModal from "./billing/DiscountModal";
import FamilySection from "./billing/FamilySection";
import { joinNames, money, monthlyCents, scrollToId, teamNames } from "./billing/format";
import PlanCards from "./billing/PlanCards";
import SubscribeDialog from "./billing/SubscribeDialog";
import "../company/CompanyPage.scss";
import "./BillingPage.scss";

/**
 * Billing: what needs doing first, then the plan this person has, the plans they could
 * start, the family they run, and each company they manage (each with its own Team bill).
 */
const BillingPage = () => {
  const billing = useBillingStore((state) => state.billing);
  const load = useBillingStore((state) => state.load);
  const refreshVault = useVaultStore((state) => state.refresh);
  const [params, setParams] = useSearchParams();
  const [interval, setBillingInterval] = useState<Interval>("year");
  const [activating, setActivating] = useState(false);
  const started = useRef(false);
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
    setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if (picked && billing) scrollToId(picked === "team" ? "billing-companies" : `plan-${picked}`);
  }, [picked, billing]);

  // Back from Stripe: wait for the webhook to confirm, instead of trusting the redirect.
  useEffect(() => {
    const result = params.get("checkout");
    if (!result || started.current) return;
    started.current = true;
    setParams({}, { replace: true });
    if (result === "cancel") {
      message.info("Checkout cancelled. Nothing was charged.");
      return;
    }
    setActivating(true);
    let tries = 0;
    const poll = window.setInterval(async () => {
      tries += 1;
      const next = await load();
      const paid =
        next?.subscription?.paid || next?.companies.some((company) => company.subscription?.paid && company.subscription.live);
      if (paid || tries >= 15) {
        window.clearInterval(poll);
        setActivating(false);
        refreshVault();
        if (paid) message.success("Payment received. Thank you!");
        else message.info("Payment received. Your plan will appear here in a moment.");
      }
    }, 2000);
    return () => window.clearInterval(poll);
  }, [params, setParams, load, refreshVault]);

  if (!billing) {
    return (
      <div className="manage-page billing-page">
        <div className="billing-loading">
          <Spin />
        </div>
      </div>
    );
  }

  // Paying for their own plan, or in a family: nothing more to buy for the personal vault.
  const ownPaid = (billing.source === "own" && billing.plan !== "free" && billing.subscription?.paid) || billing.source === "family";
  const covered = billing.source === "team";
  const showPlans = !ownPaid && (!covered || showOwnPlans);
  const teamPrice = `${money(monthlyCents(billing, "team", "year"))}–${money(monthlyCents(billing, "team", "month"))}`;

  return (
    <div className="manage-page billing-page">
      <div className="manage-head">
        <div>
          <h1>Billing</h1>
          <p>Your plan, your family and the companies you manage.</p>
        </div>
      </div>

      {activating && (
        <div className="billing-activating" role="status">
          <Spin size="small" /> Confirming your payment with Stripe…
        </div>
      )}

      <AttentionList billing={billing} onSubscribeCompany={setSubscribeFor} />

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
            You already have Premium features through {joinNames(teamNames(billing))}'s Team. You don't need a plan of your own.
          </span>
          <Button type="link" onClick={() => setShowOwnPlans(true)}>
            Buy your own plan
          </Button>
        </div>
      )}

      <FamilySection family={billing.family} />

      <section
        id="billing-companies"
        className={`billing-section${picked === "team" ? " is-picked" : ""}`}
        aria-labelledby="billing-companies-title"
      >
        <div className="billing-section-head">
          <h2 id="billing-companies-title" className="billing-label">
            Companies
          </h2>
          <span className="billing-hint">Each company has its own Team bill · {teamPrice} per accepted member a month</span>
        </div>
        {billing.companies.length === 0 ? (
          <div className="billing-card billing-empty">
            You don't manage a company yet. Create one from the vault menu (top left): it gets 14 days of Team free, no card
            needed, and its plan shows up here.
          </div>
        ) : (
          billing.companies.map((company) => (
            <CompanyCard
              key={company.id}
              billing={billing}
              company={company}
              onSubscribe={setSubscribeFor}
              onAskDiscount={setDiscountFor}
            />
          ))
        )}
      </section>

      <p className="billing-footnote">
        Prices in USD{billing.payments?.tax ? "; tax is added at checkout where it applies" : ""}. Encryption, two-factor
        sign-in and passkeys are on every plan.
      </p>

      <SubscribeDialog billing={billing} company={subscribeFor} onClose={() => setSubscribeFor(null)} />
      <DiscountModal company={discountFor} onClose={() => setDiscountFor(null)} />
    </div>
  );
};

export default BillingPage;
