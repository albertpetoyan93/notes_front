import { CopyOutlined, DownloadOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Input, Modal, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { fetcherPost } from "../../configs/axios";
import { relockForPassword, replaceRecovery } from "../../crypto/account";
import { fingerprint } from "../../crypto/e2e";
import { useAuthStore } from "../../store/authStore";
import { useKeyStore } from "../../store/keyStore";
import dayjsExtra from "../../utils/dayjs";
import { masterPasswordProblems } from "../../utils/masterPassword";
import { masterKeysFor } from "../../utils/vaultKeys";

const downloadText = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

// The recovery key, shown once, and proof the person saved it.
export const RecoveryKeyStep = ({
  recoveryKey,
  email,
  onConfirmed,
}: {
  recoveryKey: string;
  email: string;
  onConfirmed: (confirmed: boolean) => void;
}) => {
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState("");
  const lastGroup = recoveryKey.slice(-4);
  const matches = typed.trim().toUpperCase() === lastGroup;

  useEffect(() => onConfirmed(saved && matches), [saved, matches, onConfirmed]);

  return (
    <div className="e2e-recovery">
      <p>
        This is the <strong>only way back</strong> if you forget your master password. 2keevo
        can't reset it for you. Keep it <strong>outside 2keevo</strong>: on paper, or in another
        safe place.
      </p>
      <div className="e2e-recovery-key mono" aria-label="Recovery key">
        {recoveryKey}
      </div>
      <div className="e2e-recovery-actions">
        <Button
          icon={<CopyOutlined />}
          onClick={() => navigator.clipboard.writeText(recoveryKey).then(() => message.success("Recovery key copied"))}
        >
          Copy
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() =>
            downloadText(
              "2keevo-recovery-key.txt",
              `2keevo recovery key for ${email}\n\n${recoveryKey}\n\nUse it at app.2keevo.com/auth/recover if you forget your master password.\n`
            )
          }
        >
          Download .txt
        </Button>
      </div>
      <Checkbox checked={saved} onChange={(event) => setSaved(event.target.checked)}>
        I saved my recovery key somewhere safe, outside 2keevo
      </Checkbox>
      <label className="e2e-field">
        <span>Type its last 4 characters to confirm</span>
        <Input
          value={typed}
          maxLength={4}
          onChange={(event) => setTyped(event.target.value)}
          status={typed.length === 4 && !matches ? "error" : undefined}
          style={{ width: 120 }}
          className="mono"
        />
      </label>
    </div>
  );
};

// Changing the master password, or making a new recovery key: both need the
// current master password and the open vault key.
export const MasterPasswordModal = ({
  mode,
  onClose,
  forced = false,
}: {
  mode: "password" | "recovery" | null;
  onClose: () => void;
  /** After a company admin set a temporary one: the person must choose their own now. */
  forced?: boolean;
}) => {
  const { me, setStore } = useAuthStore();
  const keys = useKeyStore((state) => state.keys);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newRecovery, setNewRecovery] = useState<Awaited<ReturnType<typeof replaceRecovery>> | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError("");
    setNewRecovery(null);
    setConfirmed(false);
  }, [mode]);

  const proveCurrent = async () => {
    const signIn = await masterKeysFor(String(me?.email || ""), current);
    if (!signIn) throw new Error("End-to-end encryption isn't on.");
    return signIn.authKey;
  };

  const submit = async () => {
    if (!keys) return;
    setError("");
    setBusy(true);
    try {
      if (mode === "password") {
        if (next !== repeat) throw new Error("The two passwords don't match.");
        const found = await masterPasswordProblems(next);
        if (found.length) throw new Error(`Your master password needs ${found.join(", and ")}.`);
        const currentAuthKey = await proveCurrent();
        const change = await relockForPassword(next, keys.userKey);
        await fetcherPost("/api/auth/e2e/master-password", { ...change, currentAuthKey });
        message.success("Master password changed. Other devices were signed out.");
        if (me?.mustChangeMasterPassword) setStore({ me: { ...me, mustChangeMasterPassword: false } });
        onClose();
      } else if (!newRecovery) {
        await proveCurrent();
        setNewRecovery(await replaceRecovery(keys.userKey));
      } else {
        await fetcherPost("/api/auth/e2e/recovery-key", {
          authKey: await proveCurrent(),
          recoveryProtectedUserKey: newRecovery.recoveryProtectedUserKey,
          recoveryAuth: newRecovery.recoveryAuth,
        });
        message.success("New recovery key saved. The old one no longer works.");
        onClose();
      }
    } catch (submitError: any) {
      setError(submitError?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!mode}
      onCancel={busy || forced ? undefined : onClose}
      closable={!forced}
      zIndex={forced ? 1200 : undefined}
      cancelButtonProps={forced ? { style: { display: "none" } } : undefined}
      title={forced ? "Choose your own master password" : mode === "password" ? "Change master password" : "New recovery key"}
      okText={mode === "password" ? "Change it" : newRecovery ? "Save new recovery key" : "Continue"}
      okButtonProps={{
        loading: busy,
        disabled: !current || (mode === "password" ? !next || !repeat : !!newRecovery && !confirmed),
      }}
      onOk={submit}
      destroyOnHidden
      maskClosable={false}
      width={520}
    >
      <div className="e2e-step">
        {!keys && <Alert type="warning" showIcon message="Unlock your vault first." />}
        {forced && (
          <p className="e2e-note">
            A company admin reset your master password. Type the temporary one they gave you, then
            choose a new one only you know.
          </p>
        )}
        {!newRecovery && (
          <label className="e2e-field">
            <span>Current master password</span>
            <Input.Password autoFocus value={current} autoComplete="current-password" onChange={(event) => setCurrent(event.target.value)} />
          </label>
        )}
        {mode === "password" && (
          <>
            <label className="e2e-field">
              <span>New master password</span>
              <Input.Password value={next} autoComplete="new-password" onChange={(event) => setNext(event.target.value)} />
            </label>
            <label className="e2e-field">
              <span>Type it again</span>
              <Input.Password value={repeat} autoComplete="new-password" onChange={(event) => setRepeat(event.target.value)} />
            </label>
            <p className="e2e-note">Your items aren't re-encrypted, so this is instant. Other devices sign in again.</p>
          </>
        )}
        {mode === "recovery" && newRecovery && (
          <RecoveryKeyStep recoveryKey={newRecovery.recoveryKey} email={me?.email || ""} onConfirmed={setConfirmed} />
        )}
        {error && <p className="e2e-error">{error}</p>}
      </div>
    </Modal>
  );
};

// End-to-end encryption in Security settings.
const EncryptionSection = () => {
  const { me } = useAuthStore();
  const keys = useKeyStore((state) => state.keys);
  const [mode, setMode] = useState<"password" | "recovery" | null>(null);
  const [print, setPrint] = useState("");
  const publicKey = keys?.publicKey || me?.publicKey;
  useEffect(() => {
    if (publicKey) fingerprint(publicKey).then(setPrint).catch(() => setPrint(""));
  }, [publicKey]);

  return (
    <section className="security-section">
      <h2>End-to-end encryption</h2>
      <p className="security-section-note">
        Your items are encrypted in your browser with keys made from your master password, so
        nobody else, not even 2keevo, can read them.
      </p>
      <div className="manage-list">
        <div className="manage-row">
          <span className="manage-icon">
            <SafetyOutlined />
          </span>
          <div className="manage-main">
            <strong>
              Master password <Tag color="green">On</Tag>
            </strong>
            <span>
              {me?.e2eSince ? `On since ${dayjsExtra(me.e2eSince).format("D MMM YYYY")}. ` : ""}
              Nobody else can reset it, your company included: your recovery key is the only way back.
            </span>
          </div>
          <div className="manage-actions">
            <Button onClick={() => setMode("password")}>Change master password</Button>
            <Button onClick={() => setMode("recovery")}>New recovery key</Button>
          </div>
        </div>
        {print && (
          <div className="manage-row">
            <span className="manage-icon">
              <LockOutlined />
            </span>
            <div className="manage-main">
              <strong className="mono">{print}</strong>
              <span>
                Your key fingerprint. When someone shares with you, they can check they have the
                right key by comparing this with you, by phone or in person.
              </span>
            </div>
          </div>
        )}
      </div>
      <MasterPasswordModal mode={mode} onClose={() => setMode(null)} />
    </section>
  );
};

export default EncryptionSection;
