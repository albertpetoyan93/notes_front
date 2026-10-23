import {
  CheckOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, Input, Spin, Tooltip } from "antd";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { BrandLockup } from "../../components/header/LeftHeader";
import { fetcherGet, fetcherPost } from "../../configs/axios";
import dayjsExtra from "../../utils/dayjs";
import { isSecretField } from "../../utils/secretField";
import { passphraseMatches, unsealSecret, type SecretPayload } from "../../utils/secretLink";
import "./SecretLinkPage.scss";

interface Meta {
  expiresAt: string;
  viewsLeft: number;
  passphrase: { salt: string; check: string } | null;
}

type Phase = "loading" | "ready" | "opening" | "open" | "gone" | "broken";

// The public page for a one-time link. Nothing is used up until "Reveal".
const SecretLinkPage = () => {
  const { id = "" } = useParams();
  const fragment = window.location.hash.slice(1);
  const [phase, setPhase] = useState<Phase>(fragment ? "loading" : "broken");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<SecretPayload | null>(null);
  const [viewsLeft, setViewsLeft] = useState(0);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    document.title = "A secret for you · 2keevo";
    if (!fragment) return;
    fetcherGet(`/api/secrets/${encodeURIComponent(id)}/meta`)
      .then((data: Meta) => {
        setMeta(data);
        setPhase("ready");
      })
      .catch(() => setPhase("gone"));
  }, [id, fragment]);

  const reveal = async (event: FormEvent) => {
    event.preventDefault();
    if (!meta || phase === "opening") return;
    setError("");
    setPhase("opening");
    try {
      // A wrong passphrase is caught here, before a view is used.
      if (
        meta.passphrase &&
        !(await passphraseMatches(fragment, passphrase, meta.passphrase.salt, meta.passphrase.check))
      ) {
        setError("That passphrase isn't right. The link still works; try again.");
        setPhase("ready");
        return;
      }
      const sealed = await fetcherPost(`/api/secrets/${encodeURIComponent(id)}/open`, {});
      const payload = await unsealSecret(
        sealed,
        fragment,
        meta.passphrase ? passphrase : undefined,
        meta.passphrase?.salt
      );
      // Drop the key from the address bar, so it isn't left in the history.
      window.history.replaceState(null, "", window.location.pathname);
      setSecret(payload);
      setViewsLeft(sealed.viewsLeft);
      setPhase("open");
    } catch (openError: any) {
      if (openError?.message?.includes("no longer works")) setPhase("gone");
      else {
        setError("This link is damaged and can't be opened. Ask the sender for a new one.");
        setPhase("ready");
      }
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      /* The text is on screen to copy by hand. */
    }
  };

  const toggle = (index: number) =>
    setShown((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  let body;
  if (phase === "loading") {
    body = <Spin />;
  } else if (phase === "broken" || phase === "gone") {
    body = (
      <>
        <span className="secret-icon is-gone" aria-hidden="true">
          <WarningOutlined />
        </span>
        <h1 className="display-font">This link no longer works</h1>
        <p className="secret-text">
          {phase === "broken"
            ? "The link is incomplete. Ask the sender to send you the whole link."
            : "It was already opened, it expired, or the sender cancelled it. Ask the sender for a new link if you still need it."}
        </p>
      </>
    );
  } else if (phase === "open" && secret) {
    body = (
      <>
        <span className="secret-icon" aria-hidden="true">
          <LockOutlined />
        </span>
        <h1 className="display-font">{secret.title || "Your secret"}</h1>
        {secret.fields.length > 0 && (
          <dl className="secret-fields">
            {secret.fields.map((field, index) => {
              const sensitive = isSecretField(field.label);
              const hidden = sensitive && !shown.has(index);
              const key = `field-${index}`;
              return (
                <div key={key}>
                  <dt>{field.label}</dt>
                  <dd className={sensitive ? "mono" : undefined}>
                    <span className="secret-value">{hidden ? "••••••••••" : field.value}</span>
                    {sensitive && (
                      <Tooltip title={hidden ? "Show" : "Hide"}>
                        <Button
                          type="text"
                          size="small"
                          aria-label={hidden ? `Show ${field.label}` : `Hide ${field.label}`}
                          icon={hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                          onClick={() => toggle(index)}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title={copied === key ? "Copied" : `Copy ${field.label}`}>
                      <Button
                        type="text"
                        size="small"
                        aria-label={`Copy ${field.label}`}
                        icon={copied === key ? <CheckOutlined /> : <CopyOutlined />}
                        onClick={() => copy(field.value, key)}
                      />
                    </Tooltip>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        {secret.text && (
          <div className="secret-note">
            <pre>{secret.text}</pre>
            <Button size="small" icon={copied === "text" ? <CheckOutlined /> : <CopyOutlined />} onClick={() => copy(secret.text!, "text")}>
              {copied === "text" ? "Copied" : "Copy text"}
            </Button>
          </div>
        )}
        <p className="secret-warning">
          {viewsLeft > 0
            ? `This link can be opened ${viewsLeft} more ${viewsLeft === 1 ? "time" : "times"}. Save what you need now.`
            : "This link is now used up. Save what you need before you close this page: it can't be opened again."}
        </p>
      </>
    );
  } else if (meta) {
    body = (
      <>
        <span className="secret-icon" aria-hidden="true">
          <LockOutlined />
        </span>
        <h1 className="display-font">Someone sent you a secret</h1>
        <p className="secret-text">
          It was shared with 2keevo and is encrypted: only this link can open it.
          {meta.viewsLeft === 1
            ? " It can be opened once."
            : ` It can be opened ${meta.viewsLeft} more times.`}{" "}
          It expires {dayjsExtra(meta.expiresAt).fromNow()}.
        </p>
        <form className="secret-form" onSubmit={reveal}>
          {meta.passphrase && (
            <>
              <label htmlFor="secret-passphrase">Passphrase</label>
              <Input.Password
                id="secret-passphrase"
                size="large"
                autoFocus
                value={passphrase}
                status={error ? "error" : undefined}
                onChange={(event) => setPassphrase(event.target.value)}
              />
              <span className="secret-hint">The sender gave you this separately.</span>
            </>
          )}
          {error && (
            <p className="secret-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            block
            loading={phase === "opening"}
            disabled={!!meta.passphrase && !passphrase}
          >
            Reveal the secret
          </Button>
        </form>
        <p className="secret-hint">
          {meta.viewsLeft === 1
            ? "After you reveal it, the link stops working."
            : "Revealing it uses one of the views."}
        </p>
      </>
    );
  }

  return (
    <div className="secret-page">
      <main className="secret-card" aria-live="polite">
        <div className="secret-brand">
          <BrandLockup />
        </div>
        {body}
      </main>
      <p className="secret-footer">
        2keevo encrypts these links in the browser. The key is only in the link, so 2keevo
        itself can't read the secret.
      </p>
    </div>
  );
};

export default SecretLinkPage;
