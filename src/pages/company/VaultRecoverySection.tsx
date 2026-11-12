import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Modal, Select, Spin, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import {
  WAIT_CHOICES,
  disableRecovery,
  enableRecovery,
  recoveryStatus,
  updateRecoverySettings,
  type RecoveryStatus,
} from "../../utils/companyRecovery";
import RecoveryRequestsPanel from "./RecoveryRequestsPanel";

const waitLabel = (hours: number) => (hours === 0 ? "No wait (small teams)" : `${hours} hours`);
const waitOptions = WAIT_CHOICES.map((hours) => ({ value: hours, label: waitLabel(hours) }));

/**
 * Vault recovery (ADR-001): custodians can give someone a company vault's key
 * when nobody who holds it can, after a request, a second custodian's approval
 * and a waiting period. Never anyone's personal items.
 */
const VaultRecoverySection = ({
  companyId,
  isOwner,
  collections,
  members,
}: {
  companyId: number;
  isOwner: boolean;
  collections: { id: number; name: string }[];
  members: { userId: number; email: string; e2eEnabled?: boolean }[];
}) => {
  const myId = Number(useAuthStore((state) => state.me?.id));
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turningOn, setTurningOn] = useState(false);
  const [editingCustodians, setEditingCustodians] = useState(false);
  const [second, setSecond] = useState<number | null>(null);
  const [wait, setWait] = useState(24);
  const [custodianIds, setCustodianIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    try {
      setStatus(await recoveryStatus(companyId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      await load();
      message.success(done);
      return true;
    } catch (error: any) {
      message.error(error?.message || "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (failed) return null;
  if (!status) {
    return (
      <section className="manage-card">
        <Spin />
      </section>
    );
  }

  const others = (status.candidates || []).filter((person) => person.userId !== myId);

  const turnOn = async () => {
    if (!second) {
      message.warning("Choose a second custodian");
      return;
    }
    if (await run(() => enableRecovery(companyId, [second], wait), "Vault recovery is on")) setTurningOn(false);
  };

  const saveCustodians = async () => {
    if (custodianIds.length < 2) {
      message.warning("Keep at least two custodians");
      return;
    }
    if (await run(() => updateRecoverySettings(companyId, { custodianIds }), "Custodians saved")) setEditingCustodians(false);
  };

  const turnOff = () =>
    Modal.confirm({
      title: "Turn off vault recovery?",
      content:
        "Every recovery copy is deleted and open requests are cancelled. If everyone who can open a vault leaves or loses access, its items can't be recovered.",
      okText: "Turn it off",
      okButtonProps: { danger: true },
      onOk: () => run(() => disableRecovery(companyId), "Vault recovery is off"),
    });

  return (
    <section className="manage-card policy-card">
      <h2>
        <SafetyCertificateOutlined /> Vault recovery
      </h2>
      {!status.enabled ? (
        <>
          <p className="policy-intro">
            Vault recovery is off. If everyone who can open a vault leaves or loses access, its items can't be recovered.
          </p>
          {isOwner && (
            <Button
              type="primary"
              onClick={() => {
                setSecond(null);
                setWait(24);
                setTurningOn(true);
              }}
            >
              Turn on vault recovery
            </Button>
          )}
          <RecoveryRequestsPanel
            companyId={companyId}
            isCustodian={false}
            holdsKey={false}
            collections={collections}
            members={members}
            recoverableVaultIds={[]}
            readOnly
          />
        </>
      ) : (
        <>
          <p className="policy-intro">
            Custodians can recover a company vault, never anyone's personal items. Your company can't reset anyone's master
            password.
          </p>
          {status.keyLost && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="No custodian holds the recovery key any more"
              description="Recoveries can't run. The owner can turn vault recovery off and on again to make a new key (open requests are cancelled)."
            />
          )}
          <div className="policy-row">
            <div className="policy-main">
              <strong>Custodians</strong>
              <span>
                {status.custodians.map((person) => (
                  <Tag key={person.userId}>{person.email}</Tag>
                ))}
                {status.custodians.length < 2 && " Name a second custodian: a recovery needs two people."}
                {status.inactiveCustodians?.length > 0 &&
                  ` No longer counted (not an owner or admin any more): ${status.inactiveCustodians
                    .map((person) => person.email)
                    .join(", ")}.`}
              </span>
            </div>
            {isOwner && (
              <Button
                size="small"
                onClick={() => {
                  setCustodianIds(status.custodians.map((person) => person.userId));
                  setEditingCustodians(true);
                }}
              >
                Change
              </Button>
            )}
          </div>
          <div className="policy-row">
            <div className="policy-main">
              <strong>Waiting period</strong>
              <span>Time between a recovery's approval and when it can run. Everyone is told at each step.</span>
            </div>
            <Select
              value={status.waitHours}
              disabled={!isOwner || busy}
              onChange={(value) => run(() => updateRecoverySettings(companyId, { waitHours: value }), "Waiting period saved")}
              style={{ width: 190 }}
              aria-label="Waiting period"
              options={waitOptions}
            />
          </div>
          {isOwner && (
            <Button danger size="small" onClick={turnOff} disabled={busy}>
              Turn off
            </Button>
          )}
          <RecoveryRequestsPanel
            companyId={companyId}
            isCustodian={status.iAmCustodian}
            holdsKey={status.holdsKey}
            collections={collections}
            members={members}
            recoverableVaultIds={status.recoverableVaultIds || []}
          />
        </>
      )}

      <Modal
        title="Turn on vault recovery"
        open={turningOn}
        okText="Turn it on"
        confirmLoading={busy}
        onOk={turnOn}
        onCancel={() => setTurningOn(false)}
        destroyOnHidden
      >
        <p>
          Custodians can recover a vault, never anyone's personal items. A recovery needs a request, a second custodian's
          approval and a waiting period, and everyone is told.
        </p>
        <p>You are a custodian. Name a second one (an owner or admin with end-to-end encryption on):</p>
        {others.length ? (
          <Select
            style={{ width: "100%" }}
            placeholder="Second custodian"
            value={second ?? undefined}
            onChange={setSecond}
            options={others.map((person) => ({ value: person.userId, label: person.email }))}
          />
        ) : (
          <p className="policy-intro">
            Nobody else can be a custodian yet. Make someone an admin, and have them turn on end-to-end encryption first.
          </p>
        )}
        <p style={{ marginTop: 12 }}>Waiting period:</p>
        <Select style={{ width: "100%" }} value={wait} onChange={setWait} options={waitOptions} />
      </Modal>

      <Modal
        title="Custodians"
        open={editingCustodians}
        okText="Save"
        confirmLoading={busy}
        onOk={saveCustodians}
        onCancel={() => setEditingCustodians(false)}
        destroyOnHidden
      >
        <p>
          At least two owners or admins with end-to-end encryption on. Removing someone replaces the recovery key the next
          time a custodian opens 2keevo.
        </p>
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          value={custodianIds}
          onChange={setCustodianIds}
          options={(status.candidates || []).map((person) => ({ value: person.userId, label: person.email }))}
        />
      </Modal>
    </section>
  );
};

export default VaultRecoverySection;
