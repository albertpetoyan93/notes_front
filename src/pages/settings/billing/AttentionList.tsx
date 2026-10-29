import { InfoCircleFilled, WarningFilled } from "@ant-design/icons";
import { Button } from "antd";
import type { ReactNode } from "react";
import { useBillingStore, type Billing, type BillingCompany } from "../../../store/billingStore";
import { useVaultStore } from "../../../store/vaultStore";
import { exportCompanyItems, shareFamilyCollection, waitingForCollection } from "./companyActions";
import { date, days, daysLeft, scrollToId, useBusy } from "./format";

type Action = { key: string; label: string; run: () => Promise<unknown>; done?: string; primary?: boolean };
type Item = { key: string; tone: "warn" | "info"; title: string; text: ReactNode; actions: Action[] };

const SOON_DAYS = 3;

/** Everything that needs doing, on top: failed payments, suspended companies, ending trials, invites. */
const AttentionList = ({
  billing,
  onSubscribeCompany,
}: {
  billing: Billing;
  onSubscribeCompany: (company: BillingCompany) => void;
}) => {
  const { portal, familyAccept, familyDecline, familyCollection } = useBillingStore();
  const refreshVault = useVaultStore((state) => state.refresh);
  const { busy, run } = useBusy();
  const payments = billing.payments?.enabled;
  const items: Item[] = [];
  const own = billing.source === "own" ? billing.subscription : null;

  if (own?.live && own.status === "past_due") {
    items.push({
      key: "own-failed",
      tone: "warn",
      title: `Your ${billing.planName} payment didn't go through`,
      text: `Everything keeps working until ${date(own.graceEndsAt)} (${days(daysLeft(own.graceEndsAt))}). Update your card to keep ${billing.planName}.`,
      actions: [{ key: "own-card", label: "Update card", run: () => portal(), primary: true }],
    });
  }
  if (own?.live && own.status === "trialing" && !own.paid && daysLeft(own.trialEndsAt) <= SOON_DAYS) {
    const left = daysLeft(own.trialEndsAt);
    items.push({
      key: "own-trial",
      tone: "info",
      title: left ? `Your ${billing.planName} trial ends in ${days(left)}` : `Your ${billing.planName} trial ends today`,
      text: payments
        ? `Nothing is charged. Subscribe now and the first payment waits until ${date(own.trialEndsAt)}. If you don't, you move to Free and nothing is locked.`
        : "When it ends you move to Free. Nothing is locked or deleted.",
      actions: payments
        ? [{ key: "own-sub", label: "Choose a plan", run: async () => scrollToId("billing-plans"), primary: true }]
        : [],
    });
  }

  for (const invite of billing.family.invites) {
    items.push({
      key: `invite-${invite.id}`,
      tone: "info",
      title: `${invite.organizer} invited you to their Family`,
      text: `You'd get Premium through their plan and a shared family collection. Your own vault stays private.${
        invite.expiresAt ? ` Expires ${date(invite.expiresAt)}.` : ""
      }`,
      actions: [
        { key: `decline-${invite.id}`, label: "Decline", run: () => familyDecline(invite.id) },
        {
          key: `accept-${invite.id}`,
          label: "Join",
          primary: true,
          done: "Welcome to the family",
          run: async () => {
            await familyAccept(invite.id);
            refreshVault();
          },
        },
      ],
    });
  }

  const organizer = billing.family.organizer;
  if (organizer && !organizer.live) {
    items.push({
      key: "family-ended",
      tone: "warn",
      title: "Your Family plan has ended",
      text: "Your family is on the Free plan now. Subscribe to Family to give everyone Premium again.",
      actions: payments ? [{ key: "family-sub", label: "See Family", run: async () => scrollToId("plan-family"), primary: true }] : [],
    });
  }
  const waiting = waitingForCollection(billing.family);
  if (organizer?.live && waiting.length) {
    const who = waiting.length === 1 ? waiting[0].email : `${waiting.length} people`;
    items.push({
      key: "family-share",
      tone: "info",
      title: `${who} joined your family`,
      text: organizer.collection
        ? "Share the family collection so they can open it."
        : "Create the family collection to share Wi-Fi, streaming and other logins with them.",
      actions: [
        organizer.collection
          ? { key: "family-share", label: "Share collection", primary: true, done: "Family collection shared", run: () => shareFamilyCollection(billing.family) }
          : {
              key: "family-create",
              label: "Create collection",
              primary: true,
              done: "Family collection created",
              run: async () => {
                await familyCollection({ name: "Family" });
                refreshVault();
              },
            },
      ],
    });
  }

  for (const company of billing.companies) {
    if (company.role !== "owner") continue;
    const team = company.subscription?.live ? company.subscription : null;
    if (company.status === "suspended") {
      items.push({
        key: `suspended-${company.id}`,
        tone: "warn",
        title: `${company.name} is suspended`,
        text: company.markedForRemovalAt
          ? "Unpaid for 90 days: its items may be removed. Export them or subscribe to keep them."
          : "Its items are hidden from members but kept. Subscribe to reopen it, or export the items.",
        actions: [
          { key: `export-${company.id}`, label: "Export items", run: () => exportCompanyItems(company) },
          ...(payments
            ? [{ key: `reopen-${company.id}`, label: "Reopen", primary: true, run: async () => onSubscribeCompany(company) }]
            : []),
        ],
      });
    } else if (team?.status === "past_due") {
      items.push({
        key: `failed-${company.id}`,
        tone: "warn",
        title: `${company.name}'s payment didn't go through`,
        text: `Team keeps working until ${date(team.graceEndsAt)} (${days(daysLeft(team.graceEndsAt))}). Update the card to keep the company open.`,
        actions: [{ key: `card-${company.id}`, label: "Update card", primary: true, run: () => portal(company.id) }],
      });
    } else if (team?.status === "trialing" && !team.paid && daysLeft(team.trialEndsAt) <= SOON_DAYS) {
      items.push({
        key: `trial-${company.id}`,
        tone: "info",
        title: `${company.name}'s Team trial ends in ${days(daysLeft(team.trialEndsAt))}`,
        text: "Subscribe to keep the company open. Unpaid, it's suspended: items hidden but kept.",
        actions: payments
          ? [{ key: `sub-${company.id}`, label: "Subscribe", primary: true, run: async () => onSubscribeCompany(company) }]
          : [],
      });
    }
  }

  if (!items.length) return null;

  return (
    <section className="billing-section" aria-labelledby="billing-attention">
      <h2 id="billing-attention" className="billing-label">
        Needs attention
      </h2>
      {items.map((item) => (
        <div key={item.key} className={`billing-attention is-${item.tone}`}>
          {item.tone === "warn" ? <WarningFilled aria-hidden /> : <InfoCircleFilled aria-hidden />}
          <div className="billing-attention-text">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </div>
          {item.actions.length > 0 && (
            <div className="billing-attention-actions">
              {item.actions.map((action) => (
                <Button
                  key={action.key}
                  type={action.primary ? "primary" : "text"}
                  loading={busy === action.key}
                  onClick={() => run(action.key, action.run, action.done)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
};

export default AttentionList;
