import { CopyOutlined } from "@ant-design/icons";
import { Button, Select, Tag } from "antd";
import { useEffect, useState } from "react";
import {
  CLEAR_OPTIONS,
  clearLabel,
  clipboardReadPermission,
  getClearSeconds,
  requestClipboardRead,
  setClearSeconds,
} from "../../utils/clipboardClear";

// How long a copied password or code stays on the clipboard. Saved in this browser.
const ClipboardSection = () => {
  const [seconds, setSeconds] = useState(getClearSeconds);
  const [permission, setPermission] = useState<PermissionState | "unsupported" | null>(null);

  useEffect(() => {
    clipboardReadPermission().then(setPermission);
  }, []);

  const choose = (value: number) => {
    setSeconds(value);
    setClearSeconds(value);
  };

  return (
    <section className="security-section">
      <h2>Clipboard</h2>
      <p className="security-section-note">
        Copied passwords, codes and card numbers are removed from the clipboard after a while,
        so they can't be pasted by mistake later. Things you copy afterwards are left alone.
      </p>
      <div className="manage-list">
        <div className="manage-row">
          <span className="manage-icon">
            <CopyOutlined />
          </span>
          <div className="manage-main">
            <strong>Clear copied secrets</strong>
            <span>
              {seconds
                ? `After ${clearLabel(seconds)}. Saved in this browser.`
                : "Off. Copied secrets stay until you copy something else."}
            </span>
          </div>
          <div className="manage-actions">
            <Select
              value={seconds}
              onChange={choose}
              style={{ width: 130 }}
              aria-label="Clear copied secrets after"
              options={CLEAR_OPTIONS.map((value) => ({
                value,
                label: value ? `After ${clearLabel(value)}` : "Off",
              }))}
            />
          </div>
        </div>

        {seconds > 0 && permission !== null && permission !== "unsupported" && (
          <div className="manage-row">
            <span className="manage-icon">
              <CopyOutlined />
            </span>
            <div className="manage-main">
              <strong>
                Clear after you switch apps{" "}
                {permission === "granted" ? <Tag color="green">On</Tag> : <Tag>Off</Tag>}
              </strong>
              <span>
                {permission === "granted"
                  ? "When you come back to 2keevo, it checks the clipboard and clears the secret if it's still there."
                  : permission === "denied"
                    ? "Blocked in this browser. Allow clipboard access for this site in the browser's site settings to turn it on."
                    : "Browsers only let 2keevo clear the clipboard while its tab is open. Allow it to check the clipboard, and it also clears the secret when you come back after pasting elsewhere."}
              </span>
            </div>
            {permission === "prompt" && (
              <div className="manage-actions">
                <Button onClick={() => requestClipboardRead().then(setPermission)}>Allow</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ClipboardSection;
