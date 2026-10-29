import { Button, Input, Modal, Tag, message } from "antd";
import { useState } from "react";
import { useBillingStore, type FamilyInfo, type FamilyMemberRow } from "../../../store/billingStore";
import { useVaultStore } from "../../../store/vaultStore";
import { date, useBusy } from "./format";

/** The family this person runs: members, invitations and the family collection. */
const FamilySection = ({ family }: { family: FamilyInfo }) => {
  const { familyInvite, familyRemove, familyCollection } = useBillingStore();
  const refreshVault = useVaultStore((state) => state.refresh);
  const { busy, run } = useBusy();
  const [email, setEmail] = useState("");
  const organizer = family.organizer;
  if (!organizer) return null;

  const invite = () =>
    run(
      "invite",
      async () => {
        const result = await familyInvite(email.trim());
        setEmail("");
        if (!result.emailSent) message.info("Invite saved. They'll see it in Billing when they sign in.");
      },
      "Invitation sent"
    );

  const remove = (member: FamilyMemberRow) =>
    Modal.confirm({
      title: member.status === "invited" ? "Cancel this invitation?" : `Remove ${member.email}?`,
      content: member.status === "invited" ? undefined : "Their vault stays theirs. They lose the family collection and Premium.",
      okText: member.status === "invited" ? "Cancel invitation" : "Remove",
      okButtonProps: { danger: true },
      onOk: () => run(`remove-${member.id}`, () => familyRemove(member.id)),
    });

  const status = (member: FamilyMemberRow) =>
    member.status === "invited"
      ? `Invitation expires ${date(member.expiresAt)}.`
      : member.needsCollection
        ? "Joined. Waiting for the family collection."
        : "Joined. Has Premium and the family collection.";

  return (
    <section className="billing-section" aria-labelledby="billing-family">
      <div className="billing-section-head">
        <h2 id="billing-family" className="billing-label">
          Family
        </h2>
        <span className="billing-hint">
          {organizer.members.length} of {organizer.maxMembers} invited · each person keeps a private vault
        </span>
      </div>
      <div className="billing-card billing-people">
        {organizer.members.map((member) => (
          <div key={member.id} className="billing-person">
            <span className="billing-avatar" aria-hidden>
              {member.email.charAt(0).toUpperCase()}
            </span>
            <div className="billing-person-text">
              <strong>{member.email}</strong>
              <span>{status(member)}</span>
            </div>
            {member.status === "invited" && <Tag>Invited</Tag>}
            {member.status === "active" && member.needsCollection && <Tag color="purple">Needs collection</Tag>}
            <Button danger type="text" loading={busy === `remove-${member.id}`} onClick={() => remove(member)}>
              {member.status === "invited" ? "Cancel invite" : "Remove"}
            </Button>
          </div>
        ))}
        <div className="billing-person">
          <div className="billing-person-text">
            <strong>Family collection</strong>
            <span>
              {organizer.collection
                ? `"${organizer.collection.name}" is shared with everyone in the family; each of them can add and edit items.`
                : "One collection everyone in the family can open: Wi-Fi, streaming, the home alarm."}
            </span>
          </div>
          {!organizer.collection && (
            <Button
              disabled={!organizer.live}
              loading={busy === "collection"}
              onClick={() =>
                run(
                  "collection",
                  async () => {
                    await familyCollection({ name: "Family" });
                    refreshVault();
                  },
                  "Family collection created"
                )
              }
            >
              Create family collection
            </Button>
          )}
        </div>
        {organizer.live && organizer.members.length < organizer.maxMembers && (
          <div className="billing-card-foot">
            <Input
              type="email"
              aria-label="Invite by email"
              placeholder="Invite by email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onPressEnter={() => email.trim() && invite()}
            />
            <Button disabled={!email.trim()} loading={busy === "invite"} onClick={invite}>
              Invite
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default FamilySection;
