import { LockOutlined } from "@ant-design/icons";
import { Button, Select, message } from "antd";
import { useState } from "react";
import axios from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import {
  AUTO_LOCK_CHOICES,
  DEFAULT_AUTO_LOCK_MINUTES,
  autoLockLabel,
  lockVault,
} from "../../utils/autoLock";

// How long the vault may sit idle before it locks. Saved on the account, so
// it applies on every device.
const AutoLockSection = () => {
  const { me, setStore } = useAuthStore();
  const minutes: number = me?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES;
  // A company you belong to can require a shorter time.
  const limit: number | null = me?.autoLockLimit ?? null;
  const [saving, setSaving] = useState(false);

  const choose = async (value: number) => {
    setSaving(true);
    try {
      await axios.patch("/api/auth/settings", { autoLockMinutes: value });
      setStore({ me: { ...me, autoLockMinutes: value } });
      message.success(value ? `2keevo now locks ${autoLockLabel(value).toLowerCase()} without activity` : "Auto-lock is off");
    } catch (error: any) {
      message.error(error?.message || "Could not save the setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="security-section">
      <h2>Auto-lock</h2>
      <p className="security-section-note">
        After a while without mouse, keyboard or touch, 2keevo locks and asks for your password
        or a passkey. A closed laptop or tab counts too.
      </p>
      <div className="manage-list">
        <div className="manage-row">
          <span className="manage-icon">
            <LockOutlined />
          </span>
          <div className="manage-main">
            <strong>Lock when idle</strong>
            <span>
              {minutes
                ? `${autoLockLabel(minutes)} without activity, on every device.`
                : "Off. 2keevo stays open until you sign out."}
              {limit
                ? ` Your company requires ${autoLockLabel(limit).replace("After ", "").toLowerCase()} or less.`
                : ""}
            </span>
          </div>
          <div className="manage-actions">
            <Select
              value={minutes}
              onChange={choose}
              loading={saving}
              disabled={saving}
              style={{ width: 160 }}
              aria-label="Lock when idle"
              options={AUTO_LOCK_CHOICES.map((value) => ({
                value,
                label: autoLockLabel(value),
                disabled: !!limit && (value === 0 || value > limit),
              }))}
            />
            <Button icon={<LockOutlined />} onClick={() => lockVault()}>
              Lock now
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AutoLockSection;
