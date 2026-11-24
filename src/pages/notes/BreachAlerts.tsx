import { Button } from "antd";
import { AlertOutlined, CloseOutlined } from "@ant-design/icons";
import type { BreachAlert } from "../../utils/breachAlerts";
import { leakedSummary } from "../../utils/breachAlerts";

// Breach alerts in the vault (docs/features/breach-alerts.md). Data: Have I Been Pwned (CC BY 4.0).
const HIBP = "https://haveibeenpwned.com/PwnedWebsites";

const when = (alert: BreachAlert) => {
  const date = alert.breach.breachDate || alert.breach.addedDate;
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const logins = (n: number) => (n === 1 ? "1 login" : `${n} logins`);

interface Actions {
  onChangePassword: (noteId: number) => void;
  onDismiss: (breachName: string) => void;
}

/** One line at the top of the vault for the newest alert; "See all" opens Security health. */
export const BreachBanner = ({
  alerts,
  onChangePassword,
  onDismiss,
  onSeeAll,
}: Actions & { alerts: BreachAlert[]; onSeeAll: () => void }) => {
  const first = alerts[0];
  if (!first) return null;
  return (
    <div className="breach-banner" role="alert">
      <AlertOutlined className="breach-banner-icon" />
      <span className="breach-banner-text">
        <strong>{first.breach.title} was breached</strong> ({when(first)}). You have {logins(first.items.length)} there.
        {alerts.length > 1 && (
          <>
            {" "}
            <button type="button" className="breach-link" onClick={onSeeAll}>
              +{alerts.length - 1} more
            </button>
          </>
        )}
      </span>
      <span className="breach-banner-actions">
        <Button size="small" type="primary" danger onClick={() => onChangePassword(first.items[0].id)}>
          Change password
        </Button>
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          aria-label={`Dismiss the ${first.breach.title} alert`}
          onClick={() => onDismiss(first.breach.name)}
        />
      </span>
    </div>
  );
};

/** "Breached sites" in Security health: every alert, what leaked, and the matching logins. */
export const BreachedSites = ({
  alerts,
  onChangePassword,
  onDismiss,
  onOpen,
}: Actions & { alerts: BreachAlert[]; onOpen: (noteId: number) => void }) => (
  <section className="breached-sites" aria-label="Breached sites">
    <div className="breached-sites-head">
      <strong>Breached sites</strong>
      <span>
        {alerts.length
          ? `${alerts.length} site${alerts.length === 1 ? "" : "s"} you have logins on reported a breach.`
          : "None of the sites you have logins on reported a breach. We check every day."}
      </span>
    </div>
    {alerts.map((alert) => (
      <div key={alert.breach.name} className="breached-site">
        <div className="breached-site-main">
          <span className="breached-site-title">
            {alert.breach.title}
            {!alert.breach.isVerified && <span className="breached-site-tag">unverified</span>}
          </span>
          <span className="breached-site-sub">
            {when(alert)} · {leakedSummary(alert.breach.dataClasses)} leaked
            {alert.breach.pwnCount > 0 && ` · ${alert.breach.pwnCount.toLocaleString()} accounts`}
          </span>
          <span className="breached-site-items">
            {alert.items.map((item) => (
              <button key={item.id} type="button" className="breach-link" onClick={() => onOpen(item.id)}>
                {item.title}
              </button>
            ))}
          </span>
        </div>
        <span className="breached-site-actions">
          <Button size="small" type="primary" danger onClick={() => onChangePassword(alert.items[0].id)}>
            Change password
          </Button>
          <Button size="small" type="text" onClick={() => onDismiss(alert.breach.name)}>
            Dismiss
          </Button>
        </span>
      </div>
    ))}
    <p className="breached-sites-source">
      Breach list from{" "}
      <a href={HIBP} target="_blank" rel="noopener noreferrer">
        Have I Been Pwned
      </a>
      . Matched on this device: we don&apos;t learn which sites you use.
    </p>
  </section>
);

const NEWS_KEY = "2keevo.news.breach-alerts";

/** Whether the one-time "New: breach alerts" note was closed in this browser. */
export const breachNewsSeen = () => {
  try {
    return localStorage.getItem(NEWS_KEY) === "1";
  } catch {
    return false;
  }
};

/** A one-time note announcing breach alerts (Nov 2026); closing it hides it for good. */
export const BreachNews = ({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) => {
  const close = () => {
    try {
      localStorage.setItem(NEWS_KEY, "1");
    } catch {
      /* Private mode: it just shows again next time. */
    }
    onClose();
  };
  return (
    <div className="breach-news" role="status">
      <AlertOutlined className="breach-banner-icon" />
      <span className="breach-banner-text">
        <strong>New: free breach alerts.</strong> 2keevo now warns you when a site you have a login on reports a
        breach, checked on this device.{" "}
        <button type="button" className="breach-link" onClick={onOpen}>
          See your sites
        </button>
      </span>
      <Button size="small" type="text" icon={<CloseOutlined />} aria-label="Close" onClick={close} />
    </div>
  );
};
