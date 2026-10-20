import { CheckCircleFilled, InboxOutlined, LockOutlined, WarningFilled } from "@ant-design/icons";
import { Button, Checkbox, Input, Modal, Progress, Radio, Upload } from "antd";
import { useEffect, useState } from "react";
import ItemIcon from "../itemIcon/ItemIcon";
import useVaultNav from "../../hooks/useVaultNav";
import { useNoteStore } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import {
  IMPORT_SOURCES,
  planImport,
  toNotePayload,
  type ImportPlan,
  type ImportSource,
} from "../../utils/passwordImport";

// The import API takes up to 1000 items and 5 MB per request; 200 keeps each request small.
const BATCH = 200;
const PREVIEW_ROWS = 8;

type Step = "pick" | "preview" | "importing" | "done";

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

// Import logins from Google Password Manager, Chrome or another manager's CSV export.
const ImportPasswordsModal = () => {
  const open = useVaultStore((state) => state.importOpen);
  const setOpen = useVaultStore((state) => state.setImportOpen);
  const summary = useVaultStore((state) => state.summary);
  const refresh = useVaultStore((state) => state.refresh);
  const bumpList = useVaultStore((state) => state.bumpList);
  const importNotes = useNoteStore((state) => state.importNotes);
  const nav = useVaultNav();

  const [source, setSource] = useState<ImportSource>("google");
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState("");
  const [withDuplicates, setWithDuplicates] = useState(false);
  const [collection, setCollection] = useState(IMPORT_SOURCES[0].collection);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<{ imported: number; failed: number; stopped: string }>();

  const sourceInfo = IMPORT_SOURCES.find((item) => item.id === source) || IMPORT_SOURCES[0];

  // Passwords from the file live only in this dialog; closing it forgets them.
  useEffect(() => {
    if (open) return;
    setStep("pick");
    setPlan(null);
    setFileName("");
    setError("");
    setWithDuplicates(false);
    setDone(0);
    setResult(undefined);
  }, [open]);

  const chooseSource = (value: ImportSource) => {
    setSource(value);
    setCollection(IMPORT_SOURCES.find((item) => item.id === value)?.collection || "");
    setError("");
  };

  const readFile = async (file: File) => {
    setError("");
    try {
      const next = planImport(await file.text(), summary);
      if (!next) {
        setError("This file has no password column. Make sure you picked the passwords export (.csv).");
        return;
      }
      if (!next.items.length && !next.duplicates.length) {
        setError("No logins with a password were found in this file.");
        return;
      }
      setFileName(file.name);
      setPlan(next);
      setWithDuplicates(false);
      setStep("preview");
    } catch {
      setError("Could not read this file. Export it again and pick the .csv file.");
    }
  };

  const rows = plan ? [...plan.items, ...(withDuplicates ? plan.duplicates : [])] : [];

  const runImport = async () => {
    if (!rows.length) return;
    setStep("importing");
    setDone(0);
    let imported = 0;
    let failed = 0;
    let stopped = "";
    for (let start = 0; start < rows.length; start += BATCH) {
      const batch = rows.slice(start, start + BATCH);
      try {
        const response = await importNotes(
          batch.map((item) => toNotePayload(item, collection.trim()))
        );
        imported += response.imported;
        failed += response.failed?.length || 0;
      } catch (requestError: any) {
        failed += rows.length - start;
        stopped = requestError?.message || "The connection was interrupted.";
        break;
      }
      setDone(Math.min(start + BATCH, rows.length));
    }
    setResult({ imported, failed, stopped });
    setStep("done");
    refresh();
    bumpList();
  };

  const close = () => {
    if (step === "importing") return;
    setOpen(false);
  };

  const footer =
    step === "pick" ? null : step === "preview" ? (
      <>
        <Button onClick={() => setStep("pick")}>Back</Button>
        <Button type="primary" disabled={!rows.length} onClick={runImport}>
          Import {plural(rows.length, "item")}
        </Button>
      </>
    ) : step === "done" ? (
      <>
        <Button
          onClick={() => {
            setOpen(false);
            nav.go({ health: "1" });
          }}
        >
          Check Security health
        </Button>
        <Button
          type="primary"
          onClick={() => {
            setOpen(false);
            nav.go();
          }}
        >
          Done
        </Button>
      </>
    ) : null;

  return (
    <Modal
      open={open}
      onCancel={close}
      closable={step !== "importing"}
      maskClosable={step !== "importing"}
      keyboard={step !== "importing"}
      title="Import passwords"
      width={560}
      footer={footer}
      destroyOnClose
      className="import-modal"
    >
      {step === "pick" && (
        <div className="import-step">
          <Radio.Group
            className="import-sources"
            optionType="button"
            value={source}
            onChange={(event) => chooseSource(event.target.value)}
            options={IMPORT_SOURCES.map((item) => ({ value: item.id, label: item.label }))}
            aria-label="Import from"
          />
          <ol className="import-steps">
            {sourceInfo.steps.map((text) => (
              <li key={text}>{text}</li>
            ))}
            <li>Drop that file below.</li>
          </ol>
          <Upload.Dragger
            accept=".csv,text/csv"
            multiple={false}
            showUploadList={false}
            beforeUpload={(file) => {
              readFile(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drop the .csv file here, or click to choose it</p>
          </Upload.Dragger>
          {error && (
            <p className="import-error" role="alert">
              <WarningFilled /> {error}
            </p>
          )}
          <p className="import-privacy">
            <LockOutlined /> The file is read on this device. Only the items you import are
            sent to 2keevo, over HTTPS, and logins are stored encrypted.
          </p>
        </div>
      )}

      {step === "preview" && plan && (
        <div className="import-step">
          <p className="import-file">{fileName}</p>
          <div className="import-stats">
            <div>
              <strong className="display-font">{plan.items.length}</strong>
              <span>new</span>
            </div>
            <div>
              <strong className="display-font">{plan.duplicates.length}</strong>
              <span>already in 2keevo</span>
            </div>
            <div>
              <strong className="display-font">{plan.skippedEmpty}</strong>
              <span>empty, skipped</span>
            </div>
          </div>

          {plan.items.length > 0 && (
            <ul className="import-preview" aria-label="First items to import">
              {plan.items.slice(0, PREVIEW_ROWS).map((item) => (
                <li key={item.key}>
                  <ItemIcon
                    size="sm"
                    note={{
                      title: item.title,
                      category: item.isNote ? "note" : "password",
                      content: { customFields: [{ label: "URL", value: item.url }] },
                    }}
                  />
                  <span className="import-preview-title">{item.title}</span>
                  <span className="import-preview-sub">{item.isNote ? "Secure note" : item.username}</span>
                </li>
              ))}
              {plan.items.length > PREVIEW_ROWS && (
                <li className="import-preview-more">and {plan.items.length - PREVIEW_ROWS} more</li>
              )}
            </ul>
          )}

          {plan.duplicates.length > 0 && (
            <Checkbox checked={withDuplicates} onChange={(event) => setWithDuplicates(event.target.checked)}>
              Also import the {plural(plan.duplicates.length, "duplicate")} (same site and username)
            </Checkbox>
          )}

          <label className="import-collection">
            <span>Put them in a collection</span>
            <Input
              value={collection}
              maxLength={100}
              placeholder="No collection"
              allowClear
              onChange={(event) => setCollection(event.target.value)}
            />
          </label>
        </div>
      )}

      {step === "importing" && (
        <div className="import-step import-progress" aria-live="polite">
          <Progress percent={Math.round((100 * done) / Math.max(rows.length, 1))} />
          <p>
            Importing {done} of {rows.length}… Keep this window open.
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="import-step import-done">
          {result.imported ? (
            <CheckCircleFilled className="import-result-icon is-ok" />
          ) : (
            <WarningFilled className="import-result-icon is-bad" />
          )}
          <h3 className="display-font">
            {result.imported ? `Imported ${plural(result.imported, "item")}` : "Nothing was imported"}
          </h3>
          {result.failed > 0 && (
            <p className="import-error">
              <WarningFilled /> {plural(result.failed, "item")} could not be imported.
              {result.stopped ? ` ${result.stopped}` : ""}
            </p>
          )}
          {collection.trim() && result.imported > 0 && (
            <p>You'll find them in the “{collection.trim()}” collection.</p>
          )}
          <div className="import-warning">
            <WarningFilled />
            <span>
              Delete <strong>{fileName}</strong> now. It holds your passwords in plain text, and
              empty your Downloads trash too.
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImportPasswordsModal;
