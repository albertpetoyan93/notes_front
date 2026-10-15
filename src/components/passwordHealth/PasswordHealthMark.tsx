import { ClockCircleOutlined, RetweetOutlined, WarningOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import "./PasswordHealthMark.scss";

type Health = { weak: boolean; reused: boolean; stale: boolean };

const issues = (health: Health) =>
  [
    health.weak && "Weak password",
    health.reused && "Reused password",
    health.stale && "Not updated in 6 months",
  ].filter(Boolean) as string[];

// The worst problem is shown as icon + word, so it never depends on colour alone.
const PasswordHealthMark = ({ health }: { health?: Health }) => {
  if (!health) return null;
  const list = issues(health);
  if (!list.length) return null;

  const mark = health.weak
    ? { tone: "weak", label: "Weak", icon: <WarningOutlined /> }
    : health.reused
      ? { tone: "reused", label: "Reused", icon: <RetweetOutlined /> }
      : { tone: "stale", label: "Old", icon: <ClockCircleOutlined /> };

  return (
    <Tooltip title={list.join(" · ")}>
      <span
        className={`health-pill health-${mark.tone}`}
        aria-label={`Password health: ${list.join(", ")}`}
        tabIndex={0}
      >
        {mark.icon}
        {mark.label}
        {list.length > 1 && <span className="health-more">+{list.length - 1}</span>}
      </span>
    </Tooltip>
  );
};

export default PasswordHealthMark;
