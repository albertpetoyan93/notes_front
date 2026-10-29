import { CheckOutlined } from "@ant-design/icons";
import { Button, Modal, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBillingStore } from "../../store/billingStore";
import { useVaultStore } from "../../store/vaultStore";

const PREMIUM = [
  "Unlimited collections",
  "Share with as many people as you like",
  "Shares that end on a date",
  "Password health: weak, reused and old passwords",
];

// Opens when the server says a plan limit was reached (or a Premium feature is picked).
const UpgradeModal = () => {
  const navigate = useNavigate();
  const upgrade = useBillingStore((state) => state.upgrade);
  const billing = useBillingStore((state) => state.billing);
  const closeUpgrade = useBillingStore((state) => state.closeUpgrade);
  const startTrial = useBillingStore((state) => state.startTrial);
  const refreshVault = useVaultStore((state) => state.refresh);
  const [busy, setBusy] = useState(false);
  const canTrial = billing?.trials.premium ?? false;

  const trial = async () => {
    setBusy(true);
    try {
      await startTrial("premium");
      closeUpgrade();
      refreshVault();
      message.success("Premium is on for 14 days. No card needed.");
    } catch (error: any) {
      message.error(error?.message || "Could not start the trial");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!upgrade}
      onCancel={closeUpgrade}
      title="Upgrade to Premium"
      className="upgrade-modal"
      footer={[
        <Button
          key="plans"
          onClick={() => {
            closeUpgrade();
            navigate("/settings/billing");
          }}
        >
          See plans
        </Button>,
        canTrial ? (
          <Button key="trial" type="primary" loading={busy} onClick={trial}>
            Try Premium free for 14 days
          </Button>
        ) : null,
      ]}
    >
      {upgrade?.message && <p className="upgrade-reason">{upgrade.message}</p>}
      <ul className="upgrade-list">
        {PREMIUM.map((item) => (
          <li key={item}>
            <CheckOutlined /> {item}
          </li>
        ))}
      </ul>
      <p className="upgrade-note">
        {canTrial
          ? "No card needed for the trial. Nothing you add is ever locked: after it ends, everything stays."
          : "From $2.50 a month, billed yearly."}
      </p>
    </Modal>
  );
};

export default UpgradeModal;
