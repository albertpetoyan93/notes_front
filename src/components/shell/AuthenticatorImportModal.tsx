import { CheckCircleFilled, InboxOutlined, LockOutlined, WarningFilled } from "@ant-design/icons";
import { Button, Modal, Progress, Select, Upload } from "antd";
import { useEffect, useMemo, useState } from "react";
import ItemIcon from "../itemIcon/ItemIcon";
import { useNoteStore, type Note } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { canEditNote } from "../../pages/notes/NoteActions";
import {
  isMigrationLink,
  parseMigrationLink,
  type MigratedAccount,
} from "../../utils/authenticatorMigration";
import { categoryKey } from "../../utils/noteCategory";
import { noteFields } from "../../utils/noteFields";
import { TOTP_FIELD_LABEL, isTotpLabel, parseTotp, readQrImage } from "../../utils/totp";

type Step = "scan" | "review" | "importing" | "done";
// What to do with one account: add it to a login (its id), create one, or skip it.
type Target = number | "new" | "skip";

interface Row extends MigratedAccount {
  key: string;
  target: Target;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const simplify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const fieldValue = (note: Note, pattern: RegExp) =>
  noteFields(note)
    .filter((field) => pattern.test(field.label))
    .map((field) => field.value.trim())
    .filter(Boolean);

const hasKey = (note: Note) =>
  noteFields(note).some((field) => isTotpLabel(field.label) && parseTotp(field.value));

// How well a login fits an account: the issuer against the title and URL, the
// account name against the username or email.
const matchScore = (note: Note, account: MigratedAccount) => {
  const issuer = simplify(account.issuer);
  const title = simplify(note.title);
  let score = 0;
  if (issuer.length >= 2) {
    if (title === issuer) score += 3;
    else if (issuer.length >= 3 && (title.includes(issuer) || issuer.includes(title))) score += 2;
    else if (fieldValue(note, /^(url|uri|website|link)$/i).some((url) => simplify(url).includes(issuer)))
      score += 2;
  }
  const name = account.name.toLowerCase();
  if (name && fieldValue(note, /^(username|email|login|user)$/i).some((value) => value.toLowerCase() === name))
    score += 2;
  return score;
};

// Brings authenticator keys over from Google Authenticator's "Transfer accounts" QR codes.
const AuthenticatorImportModal = () => {
  const open = useVaultStore((state) => state.authenticatorImportOpen);
  const setOpen = useVaultStore((state) => state.setAuthenticatorImportOpen);
  const summary = useVaultStore((state) => state.summary);
  const refresh = useVaultStore((state) => state.refresh);
  const bumpList = useVaultStore((state) => state.bumpList);
  const { updateNote, importNotes } = useNoteStore();

  const [step, setStep] = useState<Step>("scan");
  // Scanned codes by "batchId:index"; a transfer can span several QR codes.
  const [batches, setBatches] = useState<Record<string, MigratedAccount[]>>({});
  const [expected, setExpected] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState({ added: 0, created: 0, failed: 0 });

  // Keys live only in this dialog; closing it forgets them.
  useEffect(() => {
    if (open) return;
    setStep("scan");
    setBatches({});
    setExpected(0);
    setRows([]);
    setError("");
    setDone(0);
  }, [open]);

  const logins = useMemo(
    () =>
      summary.filter(
        (note) => categoryKey(note.category) === "password" && canEditNote(note)
      ),
    [summary]
  );

  const scanned = Object.keys(batches).length;
  const accounts = Object.values(batches).flat();

  const addImage = async (file: Blob) => {
    setError("");
    setBusy(true);
    try {
      const text = await readQrImage(file);
      if (isMigrationLink(text)) {
        const batch = parseMigrationLink(text);
        setBatches((current) => ({
          ...current,
          [`${batch.batchId}:${batch.batchIndex}`]: batch.accounts,
        }));
        setExpected((current) => Math.max(current, batch.batchSize));
      } else if (parseTotp(text)) {
        // A single site's QR code works too.
        const config = parseTotp(text)!;
        setBatches((current) => ({
          ...current,
          [`single:${text}`]: [{ issuer: config.issuer, name: config.account, uri: text, problem: "" }],
        }));
        setExpected((current) => Math.max(current, 1));
      } else {
        setError("That QR code is not from Google Authenticator's Transfer accounts.");
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  // Screenshots can be pasted straight into the dialog.
  useEffect(() => {
    if (!open || step !== "scan") return undefined;
    const onPaste = (event: ClipboardEvent) => {
      const image = [...(event.clipboardData?.files || [])].find((file) =>
        file.type.startsWith("image/")
      );
      if (!image) return;
      event.preventDefault();
      addImage(image);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, step]);

  const review = () => {
    const seen = new Set<string>();
    const next: Row[] = [];
    accounts.forEach((account, index) => {
      const key = account.uri || `${account.issuer}:${account.name}:${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      let target: Target = account.problem ? "skip" : "new";
      if (!account.problem) {
        const best = logins
          .map((note) => ({ note, score: matchScore(note, account) }))
          .filter((item) => item.score >= 2)
          .sort((a, b) => b.score - a.score)[0];
        if (best) target = hasKey(best.note) ? "skip" : best.note.id;
      }
      next.push({ ...account, key, target });
    });
    setRows(next);
    setStep("review");
  };

  const setTarget = (key: string, target: Target) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, target } : row)));

  const toAdd = rows.filter((row) => typeof row.target === "number");
  const toCreate = rows.filter((row) => row.target === "new");
  const total = toAdd.length + toCreate.length;

  const runImport = async () => {
    setStep("importing");
    setDone(0);
    let added = 0;
    let created = 0;
    let failed = 0;

    for (const row of toAdd) {
      const note = logins.find((item) => item.id === row.target);
      if (!note) {
        failed += 1;
        continue;
      }
      const fields = noteFields(note);
      // Use the login's key field (empty, or replaced when chosen); otherwise add one.
      const at = fields.findIndex((field) => isTotpLabel(field.label));
      const nextFields =
        at >= 0
          ? fields.map((field, index) => (index === at ? { ...field, value: row.uri } : field))
          : [...fields, { label: TOTP_FIELD_LABEL, value: row.uri }];
      const content = note.content && typeof note.content === "object" ? note.content : {};
      try {
        await updateNote(note.id, { content: { ...content, customFields: nextFields } } as Partial<Note>);
        added += 1;
      } catch {
        failed += 1;
      }
      setDone((value) => value + 1);
    }

    if (toCreate.length) {
      try {
        const response = await importNotes(
          toCreate.map((row) => ({
            title: row.issuer || row.name || "Authenticator code",
            category: "password",
            content: {
              mainContent: "",
              customFields: [
                ...(row.name
                  ? [{ label: row.name.includes("@") ? "Email" : "Username", value: row.name }]
                  : []),
                { label: TOTP_FIELD_LABEL, value: row.uri },
              ],
            },
            tags: [],
            collections: [],
          }))
        );
        created += response.imported;
        failed += response.failed?.length || 0;
      } catch {
        failed += toCreate.length;
      }
      setDone((value) => value + toCreate.length);
    }

    setResult({ added, created, failed });
    setStep("done");
    refresh();
    bumpList();
  };

  const close = () => {
    if (step === "importing") return;
    setOpen(false);
  };

  const missing = expected > scanned ? expected - scanned : 0;

  const footer =
    step === "scan" ? (
      <Button type="primary" disabled={!accounts.length || busy} onClick={review}>
        {missing > 0
          ? `Continue without ${plural(missing, "code")}`
          : `Continue with ${plural(accounts.length, "account")}`}
      </Button>
    ) : step === "review" ? (
      <>
        <Button onClick={() => setStep("scan")}>Back</Button>
        <Button type="primary" disabled={!total} onClick={runImport}>
          Import {plural(total, "account")}
        </Button>
      </>
    ) : step === "done" ? (
      <Button type="primary" onClick={() => setOpen(false)}>
        Done
      </Button>
    ) : null;

  const loginOptions = logins.map((note) => {
    const user = fieldValue(note, /^(username|email|login|user)$/i)[0];
    return {
      value: note.id,
      label: user ? `${note.title} · ${user}` : note.title,
    };
  });

  return (
    <Modal
      open={open}
      onCancel={close}
      closable={step !== "importing"}
      maskClosable={step !== "importing"}
      keyboard={step !== "importing"}
      title="Import from Google Authenticator"
      width={620}
      footer={footer}
      destroyOnHidden
      className="import-modal auth-import-modal"
    >
      {step === "scan" && (
        <div className="import-step">
          <ol className="import-steps">
            <li>On your phone, open Google Authenticator.</li>
            <li>
              Tap <strong>⋮</strong> (or ☰) → <strong>Transfer accounts</strong> →{" "}
              <strong>Export accounts</strong>, choose the accounts, and tap Next.
            </li>
            <li>
              Take a screenshot of each QR code it shows, and add them here. Or show the QR code
              to your computer's camera app and paste the picture.
            </li>
          </ol>
          <Upload.Dragger
            accept="image/*"
            multiple
            showUploadList={false}
            disabled={busy}
            beforeUpload={(file) => {
              addImage(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drop the screenshots here, click to choose, or paste</p>
          </Upload.Dragger>
          {scanned > 0 && (
            <p className={`auth-import-status${missing ? " is-partial" : ""}`} aria-live="polite">
              {missing ? <WarningFilled /> : <CheckCircleFilled />}{" "}
              {plural(accounts.length, "account")} found
              {expected > 1 ? ` · ${scanned} of ${expected} QR codes` : ""}
              {missing ? ". Add the other QR codes from the same transfer." : ""}
            </p>
          )}
          {error && (
            <p className="import-error" role="alert">
              <WarningFilled /> {error}
            </p>
          )}
          <p className="import-privacy">
            <LockOutlined /> The screenshots are read on this device and never uploaded. Delete
            them afterwards: anyone with them can make your codes.
          </p>
        </div>
      )}

      {step === "review" && (
        <div className="import-step">
          <p className="auth-import-hint">
            Choose where each code goes. We picked the login that matches the site and account
            name.
          </p>
          <ul className="auth-import-list">
            {rows.map((row) => (
              <li key={row.key} className={row.problem ? "is-disabled" : undefined}>
                <ItemIcon
                  size="sm"
                  note={{ title: row.issuer || row.name, category: "password", content: {} }}
                />
                <span className="auth-import-account">
                  <strong>{row.issuer || "No site name"}</strong>
                  <small>{row.problem || row.name}</small>
                </span>
                <Select
                  value={row.target}
                  disabled={!!row.problem}
                  onChange={(value: Target) => setTarget(row.key, value)}
                  showSearch
                  optionFilterProp="label"
                  popupMatchSelectWidth={false}
                  aria-label={`Where to put ${row.issuer || row.name}`}
                  options={[
                    { value: "new", label: "Create a new login" },
                    { value: "skip", label: "Skip" },
                    ...loginOptions.map((option) => {
                      const note = logins.find((item) => item.id === option.value);
                      return note && hasKey(note)
                        ? { ...option, label: `${option.label} (replaces its key)` }
                        : option;
                    }),
                  ]}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "importing" && (
        <div className="import-step import-progress" aria-live="polite">
          <Progress percent={Math.round((100 * done) / Math.max(total, 1))} />
          <p>
            Importing {done} of {total}… Keep this window open.
          </p>
        </div>
      )}

      {step === "done" && (
        <div className="import-step import-done">
          {result.added + result.created ? (
            <CheckCircleFilled className="import-result-icon is-ok" />
          ) : (
            <WarningFilled className="import-result-icon is-bad" />
          )}
          <h3 className="display-font">
            {result.added + result.created
              ? [
                  result.added ? `Added to ${plural(result.added, "login")}` : "",
                  result.created ? `created ${plural(result.created, "new login")}` : "",
                ]
                  .filter(Boolean)
                  .join(", ")
                  .replace(/^./, (char) => char.toUpperCase())
              : "Nothing was imported"}
          </h3>
          {result.failed > 0 && (
            <p className="import-error">
              <WarningFilled /> {plural(result.failed, "account")} could not be imported.
            </p>
          )}
          <div className="import-warning">
            <WarningFilled />
            <span>
              Delete the screenshots now. Keep the accounts in Google Authenticator until you've
              signed in once with a 2keevo code.
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AuthenticatorImportModal;
