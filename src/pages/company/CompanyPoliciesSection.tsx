import { ClockCircleOutlined, KeyOutlined, LockOutlined, SafetyOutlined, UnlockOutlined } from "@ant-design/icons";
import { Modal, Select, Spin, Switch, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { fetcherGet, fetcherPut } from "../../configs/axios";
import { useCompanyStore, type CompanyPolicies } from "../../store/companyStore";
import { disableRecovery, enableRecovery, recoveryStatus, type RecoveryStatus } from "../../utils/companyRecovery";

interface PoliciesResponse {
  policies: CompanyPolicies;
  without2fa: { id: number; name: string; email: string }[];
}

const options = (values: number[], label: (value: number) => string) => [
  { value: 0, label: "No rule" },
  ...values.map((value) => ({ value, label: label(value) })),
];

// Security rules for everyone in the company. Owners and admins only.
const CompanyPoliciesSection = ({ companyId }: { companyId: number }) => {
  const loadCompanies = useCompanyStore((state) => state.load);
  const [data, setData] = useState<PoliciesResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null);
  const isOwner = useCompanyStore((state) => state.companies.find((item) => item.id === companyId)?.role === "owner");

  const load = useCallback(async () => {
    try {
      setData(await fetcherGet(`/api/companies/${companyId}/policies`));
      setRecovery(await recoveryStatus(companyId).catch(() => null));
    } catch (error: any) {
      message.error(error?.message || "Could not load the policies");
    }
  }, [companyId]);

  // Admin recovery: owners and admins can reset a member's master password.
  const toggleRecovery = (on: boolean) =>
    Modal.confirm({
      title: on ? "Let owners and admins reset master passwords?" : "Turn off admin recovery?",
      content: on
        ? "Each member's vault key is also locked for the company's owners and admins, so they can set a temporary master password for a member who forgot theirs. Members see this in their Security settings. It works for each member once they've opened 2keevo after you turn it on."
        : "Owners and admins can no longer reset master passwords. Members who forget theirs need their own recovery key.",
      okText: on ? "Turn it on" : "Turn it off",
      onOk: async () => {
        try {
          if (on) await enableRecovery(companyId);
          else await disableRecovery(companyId);
          setRecovery(await recoveryStatus(companyId));
          message.success(on ? "Admin recovery is on" : "Admin recovery is off");
        } catch (error: any) {
          message.error(error?.message || "Could not change admin recovery");
        }
      },
    });

  useEffect(() => {
    load();
  }, [load]);

  const save = async (change: Partial<CompanyPolicies>) => {
    if (!data) return;
    setSaving(true);
    try {
      const next = await fetcherPut(`/api/companies/${companyId}/policies`, {
        ...data.policies,
        ...change,
      });
      setData(next);
      loadCompanies();
      message.success("Policy saved");
    } catch (error: any) {
      message.error(error?.message || "Could not save the policy");
    } finally {
      setSaving(false);
    }
  };

  const toggle2fa = (on: boolean) => {
    if (!data) return;
    if (!on || !data.without2fa.length) {
      save({ require2fa: on });
      return;
    }
    Modal.confirm({
      title: "Require two-factor authentication?",
      content: (
        <>
          <p>
            {data.without2fa.length === 1 ? "This member doesn't" : "These members don't"} use
            two-factor authentication yet. They lose access to the company's items until they turn
            it on in their Security settings:
          </p>
          <ul className="policy-people">
            {data.without2fa.map((person) => (
              <li key={person.id}>
                {person.name} <span>{person.email}</span>
              </li>
            ))}
          </ul>
        </>
      ),
      okText: "Require it",
      onOk: () => save({ require2fa: true }),
    });
  };

  if (!data) {
    return (
      <section className="manage-card">
        <Spin />
      </section>
    );
  }
  const policies = data.policies;

  return (
    <section className="manage-card policy-card">
      <h2>Security policies</h2>
      <p className="policy-intro">Rules for everyone in the company, including owners and admins.</p>

      <div className="policy-row">
        <span className="policy-icon">
          <SafetyOutlined />
        </span>
        <div className="policy-main">
          <strong>Require two-factor authentication</strong>
          <span>
            Members without it can't open company items until they turn it on.
            {!policies.require2fa && data.without2fa.length > 0
              ? ` ${data.without2fa.length} ${data.without2fa.length === 1 ? "member doesn't" : "members don't"} use it yet.`
              : ""}
          </span>
        </div>
        <Switch
          checked={!!policies.require2fa}
          loading={saving}
          onChange={toggle2fa}
          aria-label="Require two-factor authentication"
        />
      </div>

      <div className="policy-row">
        <span className="policy-icon">
          <KeyOutlined />
        </span>
        <div className="policy-main">
          <strong>Minimum password length</strong>
          <span>For logins in company collections. Shorter ones can't be saved.</span>
        </div>
        <Select
          value={policies.minPasswordLength || 0}
          disabled={saving}
          onChange={(value) => save({ minPasswordLength: value || null })}
          style={{ width: 150 }}
          aria-label="Minimum password length"
          options={options([8, 12, 16, 20], (value) => `${value} characters`)}
        />
      </div>

      <div className="policy-row">
        <span className="policy-icon">
          <LockOutlined />
        </span>
        <div className="policy-main">
          <strong>Auto-lock at most after</strong>
          <span>Members' vault locks after this idle time, even if their own setting is longer.</span>
        </div>
        <Select
          value={policies.maxIdleMinutes || 0}
          disabled={saving}
          onChange={(value) => save({ maxIdleMinutes: value || null })}
          style={{ width: 150 }}
          aria-label="Auto-lock at most after"
          options={options([5, 15, 30, 60], (value) => (value === 60 ? "1 hour" : `${value} minutes`))}
        />
      </div>

      {recovery && (
        <div className="policy-row">
          <span className="policy-icon">
            <UnlockOutlined />
          </span>
          <div className="policy-main">
            <strong>Admin recovery</strong>
            <span>
              Owners and admins can set a temporary master password for a member who forgot theirs.
              {recovery.enabled && recovery.recoverable
                ? ` Ready for ${recovery.recoverable.length} ${recovery.recoverable.length === 1 ? "person" : "people"}.`
                : ""}
            </span>
          </div>
          <Switch
            checked={recovery.enabled}
            disabled={!isOwner}
            onChange={toggleRecovery}
            aria-label="Admin recovery"
          />
        </div>
      )}

      <div className="policy-row">
        <span className="policy-icon">
          <ClockCircleOutlined />
        </span>
        <div className="policy-main">
          <strong>Sign members in again after</strong>
          <span>A sign-in older than this ends, and the member signs in again.</span>
        </div>
        <Select
          value={policies.maxSessionDays || 0}
          disabled={saving}
          onChange={(value) => save({ maxSessionDays: value || null })}
          style={{ width: 150 }}
          aria-label="Sign members in again after"
          options={options([1, 7, 14, 30], (value) => (value === 1 ? "1 day" : `${value} days`))}
        />
      </div>
    </section>
  );
};

export default CompanyPoliciesSection;
