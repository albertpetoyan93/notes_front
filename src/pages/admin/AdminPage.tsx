import { BankOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, UserOutlined, WarningFilled } from "@ant-design/icons";
import { Button, Popconfirm, Spin, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetcherDelete, fetcherGet, fetcherPost } from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import dayjsExtra from "../../utils/dayjs";
import "../company/CompanyPage.scss";
import "../settings/SecurityPage.scss";
import "./AdminPage.scss";

type PaidPlan = "premium" | "family" | "team";
type Owner = { kind: "user" | "company"; id: number; label: string };

interface Overview {
  users: { total: number; last30Days: number };
  plans: Record<
    PaidPlan,
    { subscribers: number; monthly: number; yearly: number; seats: number; cancelling: number; mrrCents: number; trials: number }
  >;
  mrrCents: number;
  trialsEndingSoon: { id: number; plan: string; owner: Owner; trialEndsAt: string }[];
  failedPayments: { id: number; plan: string; owner: Owner; graceEndsAt: string | null }[];
  discounts: {
    percent: number;
    pending: {
      id: number;
      companyId: number;
      companyName: string;
      requestedBy: string | null;
      kind: "nonprofit" | "school";
      organization: string;
      website: string | null;
      note: string | null;
      createdAt: string;
    }[];
    active: { id: number; name: string; kind: string }[];
  };
  companies: {
    suspended: number;
    markedForRemoval: { id: number; name: string; suspendedAt: string | null; markedForRemovalAt: string | null }[];
  };
}

const PLAN_NAMES: Record<PaidPlan, string> = { premium: "Premium", family: "Family", team: "Team" };
const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = (value: string | null) => (value ? dayjsExtra(value).format("D MMM YYYY") : "—");
const ownerIcon = (owner: Owner) => (owner.kind === "company" ? <BankOutlined /> : <UserOutlined />);

// 2keevo's own view of billing: who pays, who's trying it, what failed, and discount requests.
const AdminPage = () => {
  const me = useAuthStore((state) => state.me);
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetcherGet("/api/admin/overview"));
    } catch (error: any) {
      message.error(error?.message || "Could not load the overview");
    }
  }, []);

  useEffect(() => {
    if (me?.isAdmin) load();
  }, [me?.isAdmin, load]);

  const act = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      message.success(done);
      await load();
    } catch (error: any) {
      message.error(error?.message || "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  if (me && !me.isAdmin) return <Navigate to="/" replace />;
  if (!data) {
    return (
      <div className="manage-page security-page">
        <div className="security-loading">
          <Spin />
        </div>
      </div>
    );
  }

  const plans = (Object.keys(PLAN_NAMES) as PaidPlan[]).map((plan) => ({ plan, ...data.plans[plan] }));
  const subscribers = plans.reduce((sum, row) => sum + row.subscribers, 0);
  const trials = plans.reduce((sum, row) => sum + row.trials, 0);

  return (
    <div className="manage-page security-page admin-page">
      <div className="manage-head">
        <div>
          <h1>Admin</h1>
          <p>Subscribers, trials, failed payments and discount requests. Revenue is estimated from list prices, before tax.</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          <span>Monthly revenue (est.)</span>
          <strong>{usd(data.mrrCents)}</strong>
          <small>{usd(data.mrrCents * 12)} a year</small>
        </div>
        <div className="admin-stat">
          <span>Paying subscribers</span>
          <strong>{subscribers}</strong>
          <small>{data.failedPayments.length} with a failed payment</small>
        </div>
        <div className="admin-stat">
          <span>On a free trial</span>
          <strong>{trials}</strong>
          <small>{data.trialsEndingSoon.length} ending in 3 days</small>
        </div>
        <div className="admin-stat">
          <span>Accounts</span>
          <strong>{data.users.total}</strong>
          <small>{data.users.last30Days} new in 30 days</small>
        </div>
      </div>

      <section className="security-section">
        <h2>By plan</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Subscribers</th>
                <th>Monthly / yearly</th>
                <th>Seats</th>
                <th>Cancelling</th>
                <th>Trials</th>
                <th>Revenue / month</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((row) => (
                <tr key={row.plan}>
                  <th scope="row">{PLAN_NAMES[row.plan]}</th>
                  <td>{row.subscribers}</td>
                  <td>
                    {row.monthly} / {row.yearly}
                  </td>
                  <td>{row.plan === "team" ? row.seats : "—"}</td>
                  <td>{row.cancelling}</td>
                  <td>{row.trials}</td>
                  <td>{usd(row.mrrCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="security-section">
        <h2>Discount requests</h2>
        {data.discounts.pending.length === 0 ? (
          <p className="security-section-note">No requests waiting.</p>
        ) : (
          <ul className="manage-list">
            {data.discounts.pending.map((request) => (
              <li key={request.id} className="manage-row">
                <span className="manage-icon">
                  <BankOutlined />
                </span>
                <div className="manage-main">
                  <strong>
                    {request.companyName} <Tag>{request.kind === "school" ? "School" : "Nonprofit"}</Tag>
                  </strong>
                  <span>
                    As {request.organization}
                    {request.website && (
                      <>
                        {" · "}
                        <a href={request.website} target="_blank" rel="noopener noreferrer nofollow">
                          {request.website}
                        </a>
                      </>
                    )}
                  </span>
                  {request.note && <span className="admin-note">{request.note}</span>}
                  <span>
                    {request.requestedBy || "Unknown"} · {date(request.createdAt)}
                  </span>
                </div>
                <div className="manage-actions">
                  <Button
                    icon={<CloseOutlined />}
                    loading={busy === `decline-${request.id}`}
                    onClick={() =>
                      act(`decline-${request.id}`, () => fetcherPost(`/api/admin/discounts/${request.id}/decline`, {}), "Declined. The owner was emailed.")
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={busy === `approve-${request.id}`}
                    onClick={() =>
                      act(
                        `approve-${request.id}`,
                        () => fetcherPost(`/api/admin/discounts/${request.id}/approve`, {}),
                        `Approved: ${data.discounts.percent}% off Team. The owner was emailed.`
                      )
                    }
                  >
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.discounts.active.length > 0 && (
          <>
            <h3 className="admin-subhead">With the discount</h3>
            <ul className="manage-list">
              {data.discounts.active.map((company) => (
                <li key={company.id} className="manage-row">
                  <span className="manage-icon">
                    <BankOutlined />
                  </span>
                  <div className="manage-main">
                    <strong>{company.name}</strong>
                    <span>
                      {company.kind === "school" ? "School" : "Nonprofit"}: {data.discounts.percent}% off Team
                    </span>
                  </div>
                  <div className="manage-actions">
                    <Popconfirm
                      title="Remove the discount?"
                      description="Full price from the next invoice. The owner isn't emailed."
                      okText="Remove"
                      onConfirm={() =>
                        act(`remove-${company.id}`, () => fetcherDelete(`/api/admin/companies/${company.id}/discount`), "Discount removed.")
                      }
                    >
                      <Button danger loading={busy === `remove-${company.id}`}>
                        Remove
                      </Button>
                    </Popconfirm>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="security-section">
        <h2>Failed payments</h2>
        {data.failedPayments.length === 0 ? (
          <p className="security-section-note">None. Every paid plan is up to date.</p>
        ) : (
          <ul className="manage-list">
            {data.failedPayments.map((row) => (
              <li key={row.id} className="manage-row">
                <span className="manage-icon">{ownerIcon(row.owner)}</span>
                <div className="manage-main">
                  <strong>
                    {row.owner.label} <Tag>{PLAN_NAMES[row.plan as PaidPlan] || row.plan}</Tag>
                  </strong>
                  <span>
                    <WarningFilled className="admin-warn" /> Payment failed. Grace ends {date(row.graceEndsAt)}.
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="security-section">
        <h2>Trials ending in 3 days</h2>
        {data.trialsEndingSoon.length === 0 ? (
          <p className="security-section-note">None.</p>
        ) : (
          <ul className="manage-list">
            {data.trialsEndingSoon.map((row) => (
              <li key={row.id} className="manage-row">
                <span className="manage-icon">{ownerIcon(row.owner)}</span>
                <div className="manage-main">
                  <strong>
                    {row.owner.label} <Tag>{PLAN_NAMES[row.plan as PaidPlan] || row.plan}</Tag>
                  </strong>
                  <span>Ends {date(row.trialEndsAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="security-section">
        <h2>Suspended companies</h2>
        <p className="security-section-note">
          {data.companies.suspended} suspended. Marked for removal after 90 days unpaid (nothing is deleted while removal is off):
          {data.companies.markedForRemoval.length === 0 ? " none." : ""}
        </p>
        {data.companies.markedForRemoval.length > 0 && (
          <ul className="manage-list">
            {data.companies.markedForRemoval.map((company) => (
              <li key={company.id} className="manage-row">
                <span className="manage-icon">
                  <BankOutlined />
                </span>
                <div className="manage-main">
                  <strong>{company.name}</strong>
                  <span>
                    Suspended {date(company.suspendedAt)} · marked {date(company.markedForRemovalAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AdminPage;
