import {
  CameraOutlined,
  CheckCircleFilled,
  DesktopOutlined,
  InboxOutlined,
  LockOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { Button, Modal, Progress, Select, Upload } from "antd";
import { useEffect, useMemo, useState } from "react";
import ItemIcon from "../itemIcon/ItemIcon";
import { useNoteStore, type Note } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { canEditNote } from "../../pages/notes/NoteActions";
import type { MigratedAccount } from "../../utils/authenticatorMigration";
import { accountMatchScore, userValues } from "../../utils/accountMatch";
import QrCameraModal from "../totp/QrCameraModal";
import { categoryKey } from "../../utils/noteCategory";
import { noteFields } from "../../utils/noteFields";
import {
  TOTP_FIELD_LABEL,
  canShareScreen,
  canUseCamera,
  isTotpLabel,
  keyQrAccounts,
  parseTotp,
  readQrImage,
} from "../../utils/totp";

type Step = "scan" | "review" | "importing" | "done";
// What to do with one account: add it to a login (its id), create one, or skip it.
type Target = number | "new" | "skip";

interface Row extends MigratedAccount {
  key: string;
  target: Target;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const hasKey = (note: Note) =>
  noteFields(note).some((field) => isTotpLabel(field.label) && parseTotp(field.value));

const matchScore = (note: Note, account: MigratedAccount) =>
  accountMatchScore({ title: note.title, fields: noteFields(note) }, account);

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
  // Scanning live: from the camera or a shared screen.
  const [scanner, setScanner] = useState<"camera" | "screen" | null>(null);
  // Opened by pasting a QR code in the vault: go straight to choosing where it goes.
  const [autoReview, setAutoReview] = useState(false);

  // Keys live only in this dialog; closing it forgets them.
  useEffect(() => {
    if (open) return;
    setStep("scan");
    setBatches({});
    setExpected(0);
    setRows([]);
    setError("");
    setDone(0);
    setScanner(null);
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

  const addText = (text: string) => {
    const qr = keyQrAccounts(text);
    // Keyed by the code's text, so scanning the same code twice counts once.
    setBatches((current) => ({ ...current, [text]: qr.accounts }));
    setExpected((current) => Math.max(current, qr.part?.size || 1));
  };

  const addImage = async (file: Blob) => {
    setError("");
    setBusy(true);
    try {
      addText(await readQrImage(file));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  const addCameraText = (text: string) => {
    setError("");
    try {
      addText(text);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not read that QR code.");
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

  // A QR screenshot pasted anywhere in the vault (not into a field or another
  // dialog) opens this dialog with it: a site's code or a Google Authenticator one.
  useEffect(() => {
    if (open) return undefined;
    const onPaste = async (event: ClipboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      const dialogOpen = [...document.querySelectorAll<HTMLElement>(".ant-modal-wrap")].some(
        (wrap) => getComputedStyle(wrap).display !== "none"
      );
      if (dialogOpen) return;
      const image = [...(event.clipboardData?.files || [])].find((file) => file.type.startsWith("image/"));
      if (!image) return;
      let text = "";
      try {
        text = await readQrImage(image);
        keyQrAccounts(text);
      } catch {
        // Not an authenticator QR code: leave the paste alone.
        return;
      }
      addText(text);
      setAutoReview(true);
      setOpen(true);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, setOpen]);

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

  // After a paste: all of the transfer is in, so choose where each key goes. A
  // transfer split over several QR codes waits on the scan step for the rest.
  useEffect(() => {
    if (!autoReview || !open || !accounts.length) return;
    setAutoReview(false);
    if (expected <= scanned) review();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReview, open, batches]);

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
    const user = userValues(noteFields(note))[0];
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
      title={step === "scan" ? "Import from Google Authenticator" : "Add authenticator keys"}
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
              Take a screenshot of each QR code it shows and add them here, or scan them live
              with the buttons below.
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
          {(canUseCamera() || canShareScreen()) && (
            <div className="auth-import-scan">
              {canUseCamera() && (
                <Button icon={<CameraOutlined />} disabled={busy} onClick={() => setScanner("camera")}>
                  Scan with the camera
                </Button>
              )}
              {canShareScreen() && (
                <Button icon={<DesktopOutlined />} disabled={busy} onClick={() => setScanner("screen")}>
                  Scan from the screen
                </Button>
              )}
            </div>
          )}
          <QrCameraModal
            open={!!scanner}
            source={scanner || "camera"}
            continuous
            className="auth-import-modal"
            title={scanner === "screen" ? "Scan the QR codes on your screen" : "Scan the transfer QR codes"}
            onResult={addCameraText}
            onClose={() => setScanner(null)}
            status={
              error ? (
                <p className="import-error" role="alert">
                  <WarningFilled /> {error}
                </p>
              ) : scanned > 0 ? (
                <p className={`auth-import-status${missing ? " is-partial" : ""}`}>
                  {missing ? <WarningFilled /> : <CheckCircleFilled />}{" "}
                  {plural(accounts.length, "account")} found
                  {expected > 1 ? ` · ${scanned} of ${expected} QR codes` : ""}
                  {missing ? ". Show the next QR code." : ". You can close the camera."}
                </p>
              ) : null
            }
          />
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
