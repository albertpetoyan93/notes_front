import { AlertOutlined } from "@ant-design/icons";
import { App, Switch } from "antd";
import { useEffect, useState } from "react";
import { fetcherGet, fetcherPut } from "../../configs/axios";

// Breach alerts, phase 3 (docs/features/breach-alerts.md): the opt-in weekly breach email.
const BreachEmailSection = () => {
  const { message } = App.useApp();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetcherGet("/api/breach-digest")
      .then((data) => setEnabled(!!data?.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const change = async (next: boolean) => {
    setSaving(true);
    try {
      await fetcherPut("/api/breach-digest", { enabled: next });
      setEnabled(next);
      message.success(next ? "You'll get an email when big websites are breached" : "Breach emails turned off");
    } catch {
      message.error("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="security-section">
      <h2>Breach alerts</h2>
      <p className="security-section-note">
        Your vault always warns you when a website you have a login on reports a breach. It checks on this device, so we
        don&apos;t know which sites you use.
      </p>
      <div className="manage-list">
        <div className="manage-row">
          <span className="manage-icon">
            <AlertOutlined />
          </span>
          <div className="manage-main">
            <strong>Email me about big breaches</strong>
            <span>
              At most once a week, only when big websites (over a million accounts) report a breach. Everyone gets the
              same list; open 2keevo to see if one concerns you. Needs a confirmed email address.
            </span>
          </div>
          <div className="manage-actions">
            <Switch
              checked={!!enabled}
              loading={enabled === null || saving}
              onChange={change}
              aria-label="Email me about big breaches"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default BreachEmailSection;
