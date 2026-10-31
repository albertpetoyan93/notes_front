import { CheckOutlined, ClockCircleOutlined, MedicineBoxOutlined, UserAddOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Modal, Select, Spin, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetcherDelete, fetcherGet, fetcherPost, fetcherPut } from "../../configs/axios";
import { fingerprint } from "../../crypto/e2e";
import { sealUserKeyForContact } from "../../crypto/emergency";
import { useBillingStore } from "../../store/billingStore";
import { useKeyStore } from "../../store/keyStore";
import dayjsExtra from "../../utils/dayjs";
import "../company/CompanyPage.scss";
import "../settings/SecurityPage.scss";
import "./EmergencyPage.scss";

type Status = "invited" | "accepted" | "confirmed" | "requested" | "granted";

interface Contact {
  id: number;
  email: string;
  name: string | null;
  status: Status;
  waitDays: number;
  requestedAt: string | null;
  grantsAt: string | null;
  grantedAt: string | null;
  publicKey: string | null;
}

interface TrustedBy {
  id: number;
  name: string;
  email: string | null;
  status: Status;
  waitDays: number;
  requestedAt: string | null;
  grantsAt: string | null;
  grantedAt: string | null;
}

interface Summary {
  e2e: boolean;
  included: boolean;
  maxContacts: number;
  waitDays: number[];
  contacts: Contact[];
  trustedBy: TrustedBy[];
}

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
const date = (value: string | null) => (value ? dayjsExtra(value).format("D MMM YYYY, HH:mm") : "");

const CONTACT_STATUS: Record<Status, { text: string; color?: string }> = {
  invited: { text: "Invited" },
  accepted: { text: "Needs your confirmation", color: "gold" },
  confirmed: { text: "Ready", color: "green" },
  requested: { text: "Asked for access", color: "red" },
  granted: { text: "Has access", color: "red" },
};

const TRUST_STATUS: Record<Status, { text: string; color?: string }> = {
  invited: { text: "Invitation", color: "purple" },
  accepted: { text: "Waiting for confirmation" },
  confirmed: { text: "Ready", color: "green" },
  requested: { text: "Waiting", color: "gold" },
  granted: { text: "Access", color: "green" },
};

/** The owner checks the contact's key fingerprint, then their browser seals the user key to it. */
const ConfirmModal = ({ contact, onClose, onDone }: { contact: Contact | null; onClose: () => void; onDone: () => void }) => {
  const keys = useKeyStore((state) => state.keys);
  const [print, setPrint] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrint("");
    if (contact?.publicKey) fingerprint(contact.publicKey).then(setPrint).catch(() => setPrint(""));
  }, [contact?.publicKey]);

  const confirm = async () => {
    if (!contact?.publicKey) return;
    if (!keys) {
      message.error("Your vault is locked. Unlock it and try again.");
      return;
    }
    setBusy(true);
    try {
      const sealedUserKey = await sealUserKeyForContact(contact.publicKey, contact.id, keys.userKey);
      await fetcherPost(`/api/emergency/${contact.id}/confirm`, { sealedUserKey });
      message.success(`${contact.name || contact.email} is now your emergency contact.`);
      onDone();
    } catch (error: any) {
      message.error(error?.message || "Could not confirm the contact");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!contact}
      title="Confirm your emergency contact"
      okText="Confirm"
      onOk={confirm}
      confirmLoading={busy}
      onCancel={onClose}
      okButtonProps={{ disabled: !print }}
    >
      {contact && (
        <div className="emergency-confirm">
          <p>
            {contact.name || contact.email} accepted. Before giving them a key to your vault, check it's really
            their key: ask them to read the fingerprint in their <strong>Security</strong> settings (End-to-end
            encryption), by phone or in person.
          </p>
          <div className="emergency-print">
            <span>Their fingerprint</span>
            <strong className="mono">{print || "…"}</strong>
          </div>
          <p className="security-section-note">
            If it doesn't match, cancel and remove them. Someone may be pretending to be them.
          </p>
        </div>
      )}
    </Modal>
  );
};

// Emergency access: trusted contacts who can ask for read-only access to your vault, and the people who trust you.
const EmergencyPage = () => {
  const navigate = useNavigate();
  const openUpgrade = useBillingStore((state) => state.openUpgrade);
  const [data, setData] = useState<Summary | null>(null);
  const [email, setEmail] = useState("");
  const [waitDays, setWaitDays] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetcherGet("/api/emergency"));
    } catch (error: any) {
      message.error(error?.message || "Could not load emergency access");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await action();
      if (done) message.success(done);
      await load();
      return true;
    } catch (error: any) {
      // Plan limits open the upgrade prompt on their own.
      if (error?.code !== "plan_limit") message.error(error?.message || "Something went wrong");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const invite = async () => {
    if (!data?.included) {
      openUpgrade({
        message: "Emergency access is part of Premium and Family. Upgrade to add a trusted contact.",
        feature: "emergencyAccess",
        plan: "premium",
      });
      return;
    }
    const ok = await act(
      "invite",
      () => fetcherPost("/api/emergency", { email: email.trim(), waitDays }),
      "Invitation sent. They need to accept, then you confirm them here."
    );
    if (ok) setEmail("");
  };

  const refuse = (contact: Contact) =>
    Modal.confirm({
      title: contact.status === "granted" ? "End their access?" : "Refuse the request?",
      content:
        contact.status === "granted"
          ? "They can't open your vault any more. What they already saw can't be unseen. They stay your contact and can ask again."
          : "They won't get access. They stay your contact and can ask again.",
      okText: contact.status === "granted" ? "End access" : "Refuse",
      okButtonProps: { danger: true },
      onOk: () => act(`refuse-${contact.id}`, () => fetcherPost(`/api/emergency/${contact.id}/refuse`, {}), "Done. They were told."),
    });

  const approve = (contact: Contact) =>
    Modal.confirm({
      title: "Give access now?",
      content: `${contact.name || contact.email} can read your personal vault straight away, without waiting.`,
      okText: "Give access",
      onOk: () => act(`approve-${contact.id}`, () => fetcherPost(`/api/emergency/${contact.id}/approve`, {}), "Access given."),
    });

  const remove = (contact: Contact) =>
    Modal.confirm({
      title: `Remove ${contact.name || contact.email}?`,
      content: "Their copy of your key is deleted, and any access ends at once.",
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: () => act(`remove-${contact.id}`, () => fetcherDelete(`/api/emergency/${contact.id}`), "Contact removed."),
    });

  const request = (row: TrustedBy) =>
    Modal.confirm({
      title: `Ask for access to ${row.name}'s vault?`,
      content: `${row.name} is told by email. If they don't refuse within ${days(row.waitDays)}, you can read their personal vault.`,
      okText: "Ask for access",
      onOk: () => act(`request-${row.id}`, () => fetcherPost(`/api/emergency/${row.id}/request`, {}), "Request sent."),
    });

  const leave = (row: TrustedBy) =>
    Modal.confirm({
      title: row.status === "invited" ? "Decline the invitation?" : `Stop being ${row.name}'s emergency contact?`,
      okText: row.status === "invited" ? "Decline" : "Stop",
      okButtonProps: { danger: true },
      onOk: () => act(`leave-${row.id}`, () => fetcherPost(`/api/emergency/${row.id}/leave`, {})),
    });

  if (!data) {
    return (
      <div className="manage-page security-page">
        <div className="security-loading">
          <Spin />
        </div>
      </div>
    );
  }

  const waitOptions = data.waitDays.map((value) => ({ value, label: days(value) }));

  const contactLine = (contact: Contact) => {
    switch (contact.status) {
      case "invited":
        return "Waiting for them to accept.";
      case "accepted":
        return contact.publicKey ? "Accepted. Check their fingerprint and confirm." : "Accepted. Waiting for them to turn on end-to-end encryption.";
      case "confirmed":
        return `Can ask for access. You have ${days(contact.waitDays)} to refuse.`;
      case "requested":
        return `Asked on ${date(contact.requestedAt)}. Gets access on ${date(contact.grantsAt)} unless you refuse.`;
      case "granted":
        return `Can read your personal vault since ${date(contact.grantedAt)}.`;
    }
  };

  const trustLine = (row: TrustedBy) => {
    switch (row.status) {
      case "invited":
        return `Wants you as their emergency contact. Waiting time: ${days(row.waitDays)}.`;
      case "accepted":
        return `Waiting for ${row.name} to confirm you.`;
      case "confirmed":
        return `You can ask for access. ${row.name} has ${days(row.waitDays)} to refuse.`;
      case "requested":
        return `You asked on ${date(row.requestedAt)}. Access on ${date(row.grantsAt)} unless ${row.name} refuses.`;
      case "granted":
        return `You can read ${row.name}'s personal vault (read-only).`;
    }
  };

  return (
    <div className="manage-page security-page emergency-page">
      <div className="manage-head">
        <div>
          <h1>Emergency access</h1>
          <p>
            Let someone you trust reach your vault if something happens to you. They ask for access; if you
            don't refuse within the waiting time, they can read your personal vault. They can't change it.
          </p>
        </div>
      </div>

      {!data.e2e && (
        <Alert
          className="emergency-alert"
          type="warning"
          showIcon
          message="Turn on end-to-end encryption first"
          description={
            <>
              Emergency access hands a contact a key to your vault, sealed so only they can open it. Turn it on in{" "}
              <Link to="/settings/security">Security</Link>.
            </>
          }
        />
      )}

      <section className="security-section">
        <h2>Your trusted contacts</h2>
        <p className="security-section-note">
          Up to {data.maxContacts} people with a 2keevo account. They get your personal items and collections, not
          company collections or items others shared with you. If 2keevo's servers were taken over, an attacker who
          also controlled your contact's account could skip the waiting time, so choose people you trust.
        </p>

        {data.contacts.length > 0 && (
          <ul className="manage-list emergency-list">
            {data.contacts.map((contact) => (
              <li key={contact.id} className="manage-row">
                <span className="manage-icon is-person">
                  <UserOutlined />
                </span>
                <div className="manage-main">
                  <strong>
                    {contact.name || contact.email}{" "}
                    <Tag color={CONTACT_STATUS[contact.status].color}>{CONTACT_STATUS[contact.status].text}</Tag>
                  </strong>
                  {contact.name && <span>{contact.email}</span>}
                  <span>{contactLine(contact)}</span>
                </div>
                <div className="manage-actions">
                  {contact.status === "accepted" && contact.publicKey && (
                    <Button type="primary" icon={<CheckOutlined />} onClick={() => setConfirming(contact)}>
                      Confirm
                    </Button>
                  )}
                  {(contact.status === "confirmed" || contact.status === "invited" || contact.status === "accepted") && (
                    <Select
                      aria-label="Waiting time"
                      value={contact.waitDays}
                      options={waitOptions}
                      disabled={busy === `wait-${contact.id}`}
                      onChange={(value) =>
                        act(`wait-${contact.id}`, () => fetcherPut(`/api/emergency/${contact.id}`, { waitDays: value }), "Waiting time changed.")
                      }
                      popupMatchSelectWidth={false}
                    />
                  )}
                  {contact.status === "requested" && (
                    <>
                      <Button danger type="primary" loading={busy === `refuse-${contact.id}`} onClick={() => refuse(contact)}>
                        Refuse
                      </Button>
                      <Button loading={busy === `approve-${contact.id}`} onClick={() => approve(contact)}>
                        Give access now
                      </Button>
                    </>
                  )}
                  {contact.status === "granted" && (
                    <Button danger loading={busy === `refuse-${contact.id}`} onClick={() => refuse(contact)}>
                      End access
                    </Button>
                  )}
                  <Button type="text" danger loading={busy === `remove-${contact.id}`} onClick={() => remove(contact)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {data.contacts.length < data.maxContacts && (
          <div className="emergency-add">
            <Input
              type="email"
              placeholder="Their email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onPressEnter={invite}
              disabled={!data.e2e}
            />
            <Select
              aria-label="Waiting time"
              value={waitDays}
              onChange={setWaitDays}
              options={waitOptions.map((option) => ({ ...option, label: `Wait ${option.label}` }))}
              disabled={!data.e2e}
              popupMatchSelectWidth={false}
            />
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              loading={busy === "invite"}
              disabled={!data.e2e || (data.included && !email.trim())}
              onClick={invite}
            >
              Add contact
            </Button>
          </div>
        )}
        {!data.included && (
          <p className="security-section-note emergency-plan-note">
            Part of Premium and Family.{" "}
            <Button type="link" size="small" className="emergency-inline-link" onClick={() => navigate("/settings/billing")}>
              See plans
            </Button>
          </p>
        )}
      </section>

      <section className="security-section">
        <h2>People who trust you</h2>
        {data.trustedBy.length === 0 ? (
          <p className="security-section-note">Nobody has named you as their emergency contact.</p>
        ) : (
          <ul className="manage-list emergency-list">
            {data.trustedBy.map((row) => (
              <li key={row.id} className="manage-row">
                <span className="manage-icon is-person">
                  {row.status === "requested" ? <ClockCircleOutlined /> : <MedicineBoxOutlined />}
                </span>
                <div className="manage-main">
                  <strong>
                    {row.name} <Tag color={TRUST_STATUS[row.status].color}>{TRUST_STATUS[row.status].text}</Tag>
                  </strong>
                  {row.email && row.email !== row.name && <span>{row.email}</span>}
                  <span>{trustLine(row)}</span>
                </div>
                <div className="manage-actions">
                  {row.status === "invited" && (
                    <Button
                      type="primary"
                      loading={busy === `accept-${row.id}`}
                      disabled={!data.e2e}
                      onClick={() =>
                        act(`accept-${row.id}`, () => fetcherPost(`/api/emergency/${row.id}/accept`, {}), `Accepted. ${row.name} confirms you next.`)
                      }
                    >
                      Accept
                    </Button>
                  )}
                  {row.status === "confirmed" && (
                    <Button loading={busy === `request-${row.id}`} onClick={() => request(row)}>
                      Ask for access
                    </Button>
                  )}
                  {row.status === "granted" && (
                    <Button type="primary" onClick={() => navigate(`/emergency/${row.id}`)}>
                      Open vault
                    </Button>
                  )}
                  <Button type="text" danger loading={busy === `leave-${row.id}`} onClick={() => leave(row)}>
                    {row.status === "invited" ? "Decline" : "Leave"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        contact={confirming}
        onClose={() => setConfirming(null)}
        onDone={() => {
          setConfirming(null);
          load();
        }}
      />
    </div>
  );
};

export default EmergencyPage;
