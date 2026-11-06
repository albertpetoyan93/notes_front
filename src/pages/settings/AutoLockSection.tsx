import { ChromeOutlined, LockOutlined } from "@ant-design/icons";
import { Button, Select, message } from "antd";
import { useState } from "react";
import axios from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import {
  AUTO_LOCK_CHOICES,
  DEFAULT_AUTO_LOCK_MINUTES,
  EXTENSION_AUTO_LOCK_CHOICES,
  autoLockLabel,
  lockVault,
} from "../../utils/autoLock";

const DEFAULT_EXTENSION_AUTO_LOCK_MINUTES = 60;

// How long the vault app and the browser extension may sit idle before they
// lock. Saved on the account; a company can require a shorter time for both.
const AutoLockSection = () => {
  const { me, setStore } = useAuthStore();
  const vaultMinutes: number = me?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES;
  const extensionMinutes: number =
    me?.extensionAutoLockMinutes ?? DEFAULT_EXTENSION_AUTO_LOCK_MINUTES;
  const limit: number | null = me?.autoLockLimit ?? null;
  const [saving, setSaving] = useState<"vault" | "extension" | null>(null);

  const choose = async (which: "vault" | "extension", value: number) => {
    setSaving(which);
    try {
      const body =
        which === "vault"
          ? { autoLockMinutes: value }
          : { extensionAutoLockMinutes: value };
      const { data } = await axios.patch("/api/auth/settings", body);
      setStore({
        me: {
          ...me,
          autoLockMinutes: data.autoLockMinutes ?? me?.autoLockMinutes,
          extensionAutoLockMinutes:
            data.extensionAutoLockMinutes ?? me?.extensionAutoLockMinutes,
        },
      });
      const label = autoLockLabel(value).toLowerCase();
      message.success(
        value
          ? which === "vault"
            ? `Vault app locks ${label} without activity`
            : `Extension locks ${label} without activity`
          : which === "vault"
            ? "Vault app auto-lock is off"
            : "Extension auto-lock is off"
      );
    } catch (error: any) {
      message.error(error?.message || "Could not save the setting");
    } finally {
      setSaving(null);
    }
  };

  const toOptions = (choices: readonly number[]) =>
    choices.map((value) => ({
      value,
      label: autoLockLabel(value),
      disabled: !!limit && (value === 0 || value > limit),
    }));
  const options = toOptions(AUTO_LOCK_CHOICES);
  const extensionOptions = toOptions(EXTENSION_AUTO_LOCK_CHOICES);

  const companyNote = limit
    ? ` Your company requires ${autoLockLabel(limit).replace("After ", "").toLowerCase()} or less.`
    : "";

  return (
    <section className="security-section">
      <h2>Auto-lock</h2>
      <p className="security-section-note">
        After a while without activity, 2keevo locks and asks for your password or a passkey.
        The vault app and the browser extension can use different times.
      </p>
      <div className="manage-list">
        <div className="manage-row">
          <span className="manage-icon">
            <LockOutlined />
          </span>
          <div className="manage-main">
            <strong>Vault app</strong>
            <span>
              {vaultMinutes
                ? `${autoLockLabel(vaultMinutes)} without activity in the web app.`
                : "Off. The vault app stays open until you sign out."}
              {companyNote}
            </span>
          </div>
          <div className="manage-actions">
            <Select
              value={vaultMinutes}
              onChange={(value) => choose("vault", value)}
              loading={saving === "vault"}
              disabled={!!saving}
              style={{ width: 160 }}
              aria-label="Vault app lock when idle"
              options={options}
            />
            <Button icon={<LockOutlined />} onClick={() => lockVault()}>
              Lock now
            </Button>
          </div>
        </div>
        <div className="manage-row">
          <span className="manage-icon">
            <ChromeOutlined />
          </span>
          <div className="manage-main">
            <strong>Browser extension</strong>
            <span>
              {extensionMinutes
                ? `${autoLockLabel(extensionMinutes)} without activity in the browser.`
                : "Off. The extension stays open until you sign out."}
              {companyNote}
            </span>
          </div>
          <div className="manage-actions">
            <Select
              value={extensionMinutes}
              onChange={(value) => choose("extension", value)}
              loading={saving === "extension"}
              disabled={!!saving}
              style={{ width: 160 }}
              aria-label="Extension lock when idle"
              options={extensionOptions}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AutoLockSection;
