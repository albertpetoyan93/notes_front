import { CopyOutlined, DownloadOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Input, Modal, Spin, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { fetcherPost } from "../../configs/axios";
import { createAccountKeys, relockForPassword, replaceRecovery } from "../../crypto/account";
import { fingerprint } from "../../crypto/e2e";
import { useAuthStore } from "../../store/authStore";
import { useCompanyStore } from "../../store/companyStore";
import { useKeyStore } from "../../store/keyStore";
import { recoveryStatus } from "../../utils/companyRecovery";
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

type EnableStep = "password" | "choose" | "working" | "recovery" | "saving";

// Switching on end-to-end encryption.
export const EnableModal = ({
  open,
  onClose,
  zIndex,
}: {
  open: boolean;
  onClose: () => void;
  /** Above full-screen layers (the end-to-end deadline gate). */
  zIndex?: number;
}) => {
  const { me, setStore } = useAuthStore();
  const setKeys = useKeyStore((state) => state.setKeys);
  const [step, setStep] = useState<EnableStep>("password");
  const [current, setCurrent] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Awaited<ReturnType<typeof createAccountKeys>> | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("password");
    setCurrent("");
    setProblems([]);
    setNext("");
    setRepeat("");
    setError("");
    setCreated(null);
    setConfirmed(false);
  }, [open]);

  const makeKeys = async (masterPassword: string) => {
    setStep("working");
    try {
      setCreated(await createAccountKeys(masterPassword));
      setStep("recovery");
    } catch {
      setError("Could not create your keys in this browser.");
      setStep("password");
    }
  };

  const checkCurrent = async () => {
    setError("");
    setStep("working");
    const found = await masterPasswordProblems(current);
    if (found.length) {
      setProblems(found);
      setStep("choose");
      return;
    }
    makeKeys(current);
  };

  const chooseNew = async () => {
    setError("");
    if (next !== repeat) {
      setError("The two passwords don't match.");
      return;
    }
    const found = await masterPasswordProblems(next);
    if (found.length) {
      setError(`Your master password needs ${found.join(", and ")}.`);
      return;
    }
    makeKeys(next);
  };

  const finish = async () => {
    if (!created) return;
    setStep("saving");
    try {
      await fetcherPost("/api/auth/e2e/enable", { ...created.request, password: current });
      setKeys(created.unlocked);
      setStore({ me: { ...me, e2eEnabled: true, e2eSince: new Date().toISOString() } });
      message.success("End-to-end encryption is on. Your password is now your master password.");
      onClose();
    } catch (enableError: any) {
      setError(enableError?.message || "Could not turn it on.");
      setStep("recovery");
    }
  };

  const footer =
    step === "password" ? (
      <Button type="primary" disabled={!current} onClick={checkCurrent}>
        Continue
      </Button>
    ) : step === "choose" ? (
      <Button type="primary" disabled={!next || !repeat} onClick={chooseNew}>
        Continue
      </Button>
    ) : step === "recovery" || step === "saving" ? (
      <Button type="primary" disabled={!confirmed} loading={step === "saving"} onClick={finish}>
        Turn on end-to-end encryption
      </Button>
    ) : null;

  return (
    <Modal
      open={open}
      zIndex={zIndex}
      onCancel={step === "saving" ? undefined : onClose}
      title="Turn on end-to-end encryption"
      footer={footer}
      destroyOnHidden
      maskClosable={false}
      width={520}
    >
      {step === "password" && (
        <div className="e2e-step">
          <p>
            Your 2keevo password becomes your <strong>master password</strong>: your browser makes
            your encryption keys from it, and it never leaves this device again.
          </p>
          <Alert
            type="warning"
            showIcon
            message="If you forget your master password, only your recovery key can get you back in."
          />
          <label className="e2e-field">
            <span>Your current password</span>
            <Input.Password
              autoFocus
              value={current}
              autoComplete="current-password"
              onChange={(event) => setCurrent(event.target.value)}
              onPressEnter={() => current && checkCurrent()}
            />
          </label>
          {error && <p className="e2e-error">{error}</p>}
        </div>
      )}
      {step === "choose" && (
        <div className="e2e-step">
          <Alert
            type="info"
            showIcon
            message="Choose a stronger master password"
            description={`It will protect your whole vault, so it needs ${problems.join(", and ")}.`}
          />
          <label className="e2e-field">
            <span>New master password</span>
            <Input.Password autoFocus value={next} autoComplete="new-password" onChange={(event) => setNext(event.target.value)} />
          </label>
          <label className="e2e-field">
            <span>Type it again</span>
            <Input.Password value={repeat} autoComplete="new-password" onChange={(event) => setRepeat(event.target.value)} />
          </label>
          {error && <p className="e2e-error">{error}</p>}
        </div>
      )}
      {step === "working" && (
        <div className="e2e-working">
          <Spin />
          <span>Creating your keys in this browser…</span>
        </div>
      )}
      {(step === "recovery" || step === "saving") && created && (
        <>
          <RecoveryKeyStep recoveryKey={created.recoveryKey} email={me?.email || ""} onConfirmed={setConfirmed} />
          {error && <p className="e2e-error">{error}</p>}
        </>
      )}
    </Modal>
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
  const [enableOpen, setEnableOpen] = useState(false);
  const [mode, setMode] = useState<"password" | "recovery" | null>(null);
  const [print, setPrint] = useState("");
  const publicKey = keys?.publicKey || me?.publicKey;
  // Companies whose owners and admins can reset this person's master password.
  const companies = useCompanyStore((state) => state.companies);
  const [recoveryCompanies, setRecoveryCompanies] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      companies.map(async (company) => ((await recoveryStatus(company.id).catch(() => null))?.enabled ? company.name : null))
    ).then((names) => {
      if (!cancelled) setRecoveryCompanies(names.filter((name): name is string => !!name));
    });
    return () => {
      cancelled = true;
    };
  }, [companies]);

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
              Master password {me?.e2eEnabled ? <Tag color="green">On</Tag> : <Tag>Beta</Tag>}
            </strong>
            <span>
              {me?.e2eEnabled
                ? `On since ${dayjsExtra(me.e2eSince).format("D MMM YYYY")}. Your password is your master password.`
                : "Your items get encrypted in your browser. Your password becomes your master password, and you get a recovery key."}
              {recoveryCompanies.length > 0 &&
                ` Owners and admins of ${recoveryCompanies.join(", ")} can also reset it (a company policy).`}
            </span>
          </div>
          <div className="manage-actions">
            {me?.e2eEnabled ? (
              <>
                <Button onClick={() => setMode("password")}>Change master password</Button>
                <Button onClick={() => setMode("recovery")}>New recovery key</Button>
              </>
            ) : (
              <Button type="primary" icon={<LockOutlined />} onClick={() => setEnableOpen(true)}>
                Turn on
              </Button>
            )}
          </div>
        </div>
        {me?.e2eEnabled && print && (
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
      <EnableModal open={enableOpen} onClose={() => setEnableOpen(false)} />
      <MasterPasswordModal mode={mode} onClose={() => setMode(null)} />
    </section>
  );
};

export default EncryptionSection;
