import { LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { EnableModal } from "../../pages/settings/EncryptionSection";
import dayjsExtra from "../../utils/dayjs";
import { BrandLockup } from "../header/LeftHeader";
import "./LockScreen.scss";

const day = (deadline: string) => dayjsExtra(deadline).format("D MMMM YYYY");

// Accounts without end-to-end encryption, before the deadline (E2E_DEADLINE): a reminder.
export const E2EBanner = ({ deadline }: { deadline: string }) => {
  const navigate = useNavigate();
  return (
    <div className="e2e-banner" role="status">
      <SafetyOutlined aria-hidden="true" />
      <span className="e2e-banner-text">
        Turn on end-to-end encryption by <strong>{day(deadline)}</strong>, so nobody else (not even
        2keevo) can read your vault.
      </span>
      <Button size="small" type="primary" onClick={() => navigate("/settings/security")}>
        Turn it on
      </Button>
    </div>
  );
};

// After the deadline: the vault opens only once it's on.
export const E2EGate = ({ deadline }: { deadline: string }) => {
  const { logOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-labelledby="e2e-gate-title">
      <div className="lock-card">
        <div className="lock-brand">
          <BrandLockup />
        </div>
        <span className="lock-icon" aria-hidden="true">
          <LockOutlined />
        </span>
        <h1 id="e2e-gate-title" className="display-font">
          Turn on end-to-end encryption
        </h1>
        <p className="lock-note">
          Since {day(deadline)}, every 2keevo vault is encrypted in the browser. Your password becomes
          your master password, and you get a recovery key. It takes a minute.
        </p>
        <Button type="primary" size="large" block onClick={() => setOpen(true)}>
          Turn it on
        </Button>
        <Button type="link" onClick={() => logOut()}>
          Sign out instead
        </Button>
      </div>
      {/* The gate is a full-screen layer (z-index 1100): the dialog goes above it. */}
      <EnableModal open={open} onClose={() => setOpen(false)} zIndex={1200} />
    </div>
  );
};
