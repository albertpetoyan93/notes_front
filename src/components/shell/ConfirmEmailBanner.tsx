import { MailOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import { useState } from "react";
import { fetcherPost } from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import { CONFIRM_BANNER_KEY, showConfirmBanner } from "./confirmEmailRule";

const readLater = () => {
  try {
    const value = Number(localStorage.getItem(CONFIRM_BANNER_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

// Unconfirmed address (F15): invites to it and shares by email wait until it's confirmed.
const ConfirmEmailBanner = () => {
  const me = useAuthStore((state) => state.me);
  const [later, setLater] = useState<number | null>(readLater);
  const [busy, setBusy] = useState(false);
  if (!showConfirmBanner(me, later, Date.now())) return null;

  const resend = async () => {
    setBusy(true);
    try {
      await fetcherPost("/api/auth/email/resend", {});
      message.success(`We sent a new link to ${me.email}.`);
    } catch (error: any) {
      message.error(error?.message || "Could not send the link. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  const snooze = () => {
    const now = Date.now();
    try {
      localStorage.setItem(CONFIRM_BANNER_KEY, String(now));
    } catch {
      // Private mode: hidden for this page only.
    }
    setLater(now);
  };

  return (
    <div className="e2e-banner" role="status">
      <MailOutlined aria-hidden="true" />
      <span className="e2e-banner-text">
        Confirm your email <strong>{me.email}</strong>: open the link we sent. Until then, invites and
        items shared to this address can't reach you.
      </span>
      <Button size="small" type="primary" loading={busy} onClick={resend}>
        Send a new link
      </Button>
      <Button size="small" type="text" onClick={snooze}>
        Later
      </Button>
    </div>
  );
};

export default ConfirmEmailBanner;
