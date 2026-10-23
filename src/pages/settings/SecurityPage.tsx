import {
  ChromeOutlined,
  DesktopOutlined,
  LogoutOutlined,
  MobileOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  QRCode,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import ActivityList from "../../components/activity/ActivityList";
import { fetcherDelete, fetcherGet, fetcherPost } from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import dayjsExtra from "../../utils/dayjs";
import { browserAndOs, isPhoneAgent } from "../../utils/device";
import "../company/CompanyPage.scss";
import PasskeysSection from "./PasskeysSection";
import "./SecurityPage.scss";

interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
}

interface SessionRow {
  id: number;
  kind: "web" | "extension";
  userAgent?: string | null;
  ip?: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

const deviceLabel = (session: SessionRow) => {
  const name = browserAndOs(session.userAgent) || "Browser";
  return session.kind === "extension" ? `Browser extension · ${name}` : name;
};

const deviceIcon = (session: SessionRow) => {
  if (session.kind === "extension") return <ChromeOutlined />;
  if (isPhoneAgent(session.userAgent)) return <MobileOutlined />;
  return <DesktopOutlined />;
};

const errorText = (err: any, fallback: string) => err?.message || fallback;

const RecoveryCodes = ({ codes }: { codes: string[] }) => {
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`2keevo recovery codes\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "2keevo-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="recovery-codes">
      <p>
        Each code signs you in once if you lose your phone. Keep them outside 2keevo, on paper
        or in another safe place: if you are locked out, you can't open 2keevo to read them.
        They will not be shown again.
      </p>
      <ul>
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="recovery-codes-actions">
        <Typography.Text copyable={{ text, tooltips: ["Copy all", "Copied"] }}>Copy</Typography.Text>
        <Button size="small" onClick={download}>
          Download .txt
        </Button>
      </div>
    </div>
  );
};

// Turn on: scan the QR code, confirm one code, then save the recovery codes.
const EnableModal = ({ open, onClose }: { open: boolean; onClose: (changed: boolean) => void }) => {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSetup(null);
    setCode("");
    setCodes(null);
    setSaved(false);
    fetcherPost("/api/auth/2fa/setup", {})
      .then(setSetup)
      .catch((err) => {
        message.error(errorText(err, "Could not start the setup"));
        onClose(false);
      });
    // onClose is recreated by the parent on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enable = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return;
    setBusy(true);
    try {
      const data = await fetcherPost("/api/auth/2fa/enable", { code: value });
      setCodes(data.recoveryCodes);
    } catch (err) {
      message.error(errorText(err, "That code is not valid"));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <Modal
        open={open}
        title="Save your recovery codes"
        closable={false}
        maskClosable={false}
        footer={
          <Button type="primary" disabled={!saved} onClick={() => onClose(true)}>
            Done
          </Button>
        }
      >
        <RecoveryCodes codes={codes} />
        <Checkbox checked={saved} onChange={(event) => setSaved(event.target.checked)}>
          I saved my recovery codes
        </Checkbox>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title="Turn on two-factor authentication"
      onCancel={() => onClose(false)}
      okText="Turn on"
      okButtonProps={{ disabled: code.length !== 6, loading: busy }}
      onOk={() => enable()}
    >
      {!setup ? (
        <div className="security-loading">
          <Spin />
        </div>
      ) : (
        <div className="enable-2fa">
          <p>
            1. Scan this QR code with an authenticator app, such as Google Authenticator,
            1Password, Authy or Microsoft Authenticator.
          </p>
          <div className="enable-2fa-qr">
            <QRCode value={setup.otpauthUrl} size={176} bordered={false} />
          </div>
          <p className="enable-2fa-secret">
            Can't scan it? Enter this key instead:{" "}
            <Typography.Text code copyable>
              {setup.secret}
            </Typography.Text>
          </p>
          <p>2. Enter the 6-digit code the app shows.</p>
          <Input.OTP
            length={6}
            value={code}
            inputMode="numeric"
            formatter={(value) => value.replace(/\D/g, "")}
            onChange={(value) => {
              setCode(value);
              if (/^\d{6}$/.test(value)) enable(value);
            }}
          />
        </div>
      )}
    </Modal>
  );
};

// Turn off or get new recovery codes: both ask for a current code.
const CodeModal = ({
  mode,
  onClose,
}: {
  mode: "disable" | "regenerate" | null;
  onClose: (changed: boolean) => void;
}) => {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword("");
    setCode("");
    setCodes(null);
  }, [mode]);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "disable") {
        await fetcherPost("/api/auth/2fa/disable", { password, code });
        message.success("Two-factor authentication is off");
        onClose(true);
      } else {
        const data = await fetcherPost("/api/auth/2fa/recovery-codes", { code });
        setCodes(data.recoveryCodes);
      }
    } catch (err) {
      message.error(errorText(err, "That code is not valid"));
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <Modal
        open
        title="New recovery codes"
        closable={false}
        maskClosable={false}
        footer={
          <Button type="primary" onClick={() => onClose(true)}>
            Done
          </Button>
        }
      >
        <p>Your old recovery codes no longer work.</p>
        <RecoveryCodes codes={codes} />
      </Modal>
    );
  }

  return (
    <Modal
      open={!!mode}
      title={mode === "disable" ? "Turn off two-factor authentication" : "Get new recovery codes"}
      onCancel={() => onClose(false)}
      okText={mode === "disable" ? "Turn off" : "Get new codes"}
      okButtonProps={{
        danger: mode === "disable",
        loading: busy,
        disabled: !code.trim() || (mode === "disable" && !password),
      }}
      onOk={submit}
    >
      <div className="code-modal">
        {mode === "disable" && (
          <>
            <p>Your account will be protected by your password only.</p>
            <label htmlFor="disable-2fa-password">Password</label>
            <Input.Password
              id="disable-2fa-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </>
        )}
        <label htmlFor="code-modal-code">Code from your authenticator app, or a recovery code</label>
        <Input
          id="code-modal-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          autoComplete="off"
          onPressEnter={() => code.trim() && submit()}
        />
      </div>
    </Modal>
  );
};

const SecurityPage = () => {
  const { me, setStore } = useAuthStore();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [enableOpen, setEnableOpen] = useState(false);
  const [codeMode, setCodeMode] = useState<"disable" | "regenerate" | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextStatus, nextSessions] = await Promise.all([
        fetcherGet("/api/auth/2fa/status"),
        fetcherGet("/api/auth/sessions"),
      ]);
      setStatus(nextStatus);
      setSessions(
        [...nextSessions].sort((a: SessionRow, b: SessionRow) => Number(b.current) - Number(a.current))
      );
      if (me && me.twoFactorEnabled !== nextStatus.enabled) {
        setStore({ me: { ...me, twoFactorEnabled: nextStatus.enabled } });
      }
    } catch (err) {
      message.error(errorText(err, "Could not load security settings"));
    }
  }, [me, setStore]);

  useEffect(() => {
    load();
    // Load once; load() itself refreshes the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revoke = (session: SessionRow) => {
    Modal.confirm({
      title: `Sign out ${deviceLabel(session)}?`,
      okText: "Sign out",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherDelete(`/api/auth/sessions/${session.id}`);
          setSessions((rows) => rows?.filter((row) => row.id !== session.id) || null);
        } catch (err) {
          message.error(errorText(err, "Could not sign out that device"));
        }
      },
    });
  };

  const revokeOthers = () => {
    Modal.confirm({
      title: "Sign out all other devices?",
      content: "Every browser and extension except this one will need to sign in again.",
      okText: "Sign out others",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherPost("/api/auth/sessions/revoke-others", {});
          setSessions((rows) => rows?.filter((row) => row.current) || null);
        } catch (err) {
          message.error(errorText(err, "Could not sign out other devices"));
        }
      },
    });
  };

  const others = (sessions || []).filter((session) => !session.current).length;

  return (
    <div className="manage-page security-page">
      <div className="manage-head">
        <div>
          <h1>Security</h1>
          <p>Passkeys, a second sign-in step, and where you are signed in.</p>
        </div>
      </div>

      <section className="security-section">
        <h2>Two-factor authentication</h2>
        {!status ? (
          <div className="security-loading">
            <Spin />
          </div>
        ) : (
          <div className="manage-list">
            <div className="manage-row">
              <span className="manage-icon">
                <SafetyOutlined />
              </span>
              <div className="manage-main">
                <strong>
                  Authenticator app{" "}
                  {status.enabled ? <Tag color="green">On</Tag> : <Tag>Off</Tag>}
                </strong>
                <span>
                  {status.enabled
                    ? `A code from your app is needed when you sign in on a new device. ${status.recoveryCodesLeft} recovery ${status.recoveryCodesLeft === 1 ? "code" : "codes"} left.`
                    : "After your password, also ask for a 6-digit code from an authenticator app."}
                </span>
              </div>
              <div className="manage-actions">
                {status.enabled ? (
                  <>
                    <Button onClick={() => setCodeMode("regenerate")}>New recovery codes</Button>
                    <Button danger onClick={() => setCodeMode("disable")}>
                      Turn off
                    </Button>
                  </>
                ) : (
                  <Button type="primary" onClick={() => setEnableOpen(true)}>
                    Turn on
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <PasskeysSection />

      <section className="security-section">
        <div className="security-section-head">
          <h2>Where you're signed in</h2>
          {others > 0 && (
            <Button icon={<LogoutOutlined />} onClick={revokeOthers}>
              Sign out other devices
            </Button>
          )}
        </div>
        {!sessions ? (
          <div className="security-loading">
            <Spin />
          </div>
        ) : (
          <ul className="manage-list">
            {sessions.map((session) => (
              <li key={session.id} className="manage-row">
                <span className="manage-icon">{deviceIcon(session)}</span>
                <div className="manage-main">
                  <strong>
                    {deviceLabel(session)}{" "}
                    {session.current && <Tag color="purple">This device</Tag>}
                  </strong>
                  <span>
                    {session.current
                      ? "Active now"
                      : `Last active ${dayjsExtra(session.lastUsedAt).fromNow()}`}
                    {session.ip ? ` · ${session.ip}` : ""}
                    {` · Signed in ${dayjsExtra(session.createdAt).format("ll")}`}
                  </span>
                </div>
                <div className="manage-actions">
                  {!session.current && (
                    <Button size="small" onClick={() => revoke(session)}>
                      Sign out
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="security-section">
        <h2>Recent account activity</h2>
        <p className="security-section-note">
          Sign-ins, wrong passwords or codes, and security changes. If you don't recognise
          something, change your password and sign out other devices.
        </p>
        <div className="manage-card">
          <ActivityList url="/api/auth/activity" emptyText="No activity yet." />
        </div>
      </section>

      <EnableModal
        open={enableOpen}
        onClose={(changed) => {
          setEnableOpen(false);
          if (changed) {
            message.success("Two-factor authentication is on. Other devices were signed out.");
            load();
          }
        }}
      />
      <CodeModal
        mode={codeMode}
        onClose={(changed) => {
          setCodeMode(null);
          if (changed) load();
        }}
      />
    </div>
  );
};

export default SecurityPage;
