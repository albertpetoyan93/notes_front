import { CheckCircleFilled, CopyOutlined, LinkOutlined, LockOutlined } from "@ant-design/icons";
import { Button, Checkbox, Input, Modal, Select, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetcherPost } from "../../configs/axios";
import useFieldClipboard from "../../hooks/useFieldClipboard";
import type { Note } from "../../store/noteStore";
import dayjsExtra from "../../utils/dayjs";
import { isSecretField, noteBody, noteFields } from "../../utils/noteFields";
import {
  EXPIRY_OPTIONS,
  VIEW_OPTIONS,
  sealSecret,
  secretLinkUrl,
  type SecretPayload,
} from "../../utils/secretLink";
import "./SendLinkModal.scss";

interface Created {
  url: string;
  expiresAt: string;
  maxViews: number;
  passphrase: boolean;
}

// Send an item (or any text) as a one-time link. Encrypted here, before it's sent.
const SendLinkModal = ({
  open,
  note,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** The item to send; without it the person types the secret. */
  note?: Note | null;
  onClose: () => void;
  onCreated?: () => void;
}) => {
  const fields = useMemo(
    () => (note ? noteFields(note).filter((field) => field.value.trim()) : []),
    [note]
  );
  const body = note ? noteBody(note) : "";
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [withNotes, setWithNotes] = useState(false);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState(24);
  const [views, setViews] = useState(1);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const clipboard = useFieldClipboard();

  // Fresh each time it opens; the secret only lives in this dialog.
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(fields.map((_, index) => index)));
    setWithNotes(false);
    setText("");
    setLabel(note?.title || "");
    setHours(24);
    setViews(1);
    setPassphrase("");
    setCreated(null);
  }, [open, note, fields]);

  const payload = (): SecretPayload => ({
    v: 1,
    title: note?.title || label.trim() || undefined,
    fields: fields.filter((_, index) => picked.has(index)),
    text: note ? (withNotes ? body : undefined) : text,
  });

  const empty = note ? picked.size === 0 && !(withNotes && body) : !text.trim();

  const create = async () => {
    if (empty || busy) return;
    setBusy(true);
    try {
      const { body: sealed, fragment } = await sealSecret(payload(), passphrase || undefined);
      const link = await fetcherPost("/api/secrets", {
        ...sealed,
        expiresInHours: hours,
        maxViews: views,
        label: label.trim(),
        noteId: note?.id,
      });
      setCreated({
        url: secretLinkUrl(link.id, fragment),
        expiresAt: link.expiresAt,
        maxViews: link.maxViews,
        passphrase: Boolean(passphrase),
      });
      onCreated?.();
    } catch (error: any) {
      message.error(error?.message || "Could not create the link");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (index: number, checked: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={created ? "Your one-time link" : note ? `Send "${note.title}" as a link` : "New one-time link"}
      width={520}
      destroyOnHidden
      className="send-link-modal"
      footer={
        created ? (
          <Button type="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" icon={<LinkOutlined />} loading={busy} disabled={empty} onClick={create}>
              Create link
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="send-link-done">
          <CheckCircleFilled className="send-link-ok" />
          <div className="send-link-url">
            <Input readOnly value={created.url} aria-label="One-time link" onFocus={(event) => event.target.select()} />
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => clipboard.copy(created.url, "link", "Link", true)}
            >
              {clipboard.isCopied("link") ? "Copied" : "Copy"}
            </Button>
          </div>
          <ul className="send-link-facts">
            <li>
              Opens {created.maxViews === 1 ? "once" : `${created.maxViews} times`}, until{" "}
              {dayjsExtra(created.expiresAt).format("D MMM, HH:mm")}. Then it stops working.
            </li>
            {created.passphrase && (
              <li>
                <LockOutlined /> Tell them the passphrase another way, for example by phone. Don't
                send it with the link.
              </li>
            )}
            <li>You'll get a notification when it's opened.</li>
            <li>
              Changed your mind? Cancel it in <Link to="/links" onClick={onClose}>One-time links</Link>.
            </li>
          </ul>
          <p className="send-link-note">
            2keevo can't read this secret: it was encrypted here, and the key is only in the link.
            So this is the only time you see the link. Copy it now.
          </p>
        </div>
      ) : (
        <div className="send-link-form">
          {note ? (
            <fieldset>
              <legend>What to send</legend>
              {fields.map((field, index) => (
                <Checkbox
                  key={`${field.label}-${index}`}
                  checked={picked.has(index)}
                  onChange={(event) => toggle(index, event.target.checked)}
                >
                  {field.label}
                  {isSecretField(field.label) && <span className="send-link-secret">secret</span>}
                </Checkbox>
              ))}
              {body && (
                <Checkbox checked={withNotes} onChange={(event) => setWithNotes(event.target.checked)}>
                  Notes
                </Checkbox>
              )}
            </fieldset>
          ) : (
            <label className="send-link-field">
              <span>Secret</span>
              <Input.TextArea
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                autoSize={{ minRows: 4, maxRows: 10 }}
                placeholder="A password, an API key, a recovery code…"
                spellCheck={false}
              />
            </label>
          )}

          <div className="send-link-row">
            <label className="send-link-field">
              <span>Stops working after</span>
              <Select value={hours} onChange={setHours} options={EXPIRY_OPTIONS} />
            </label>
            <label className="send-link-field">
              <span>Can be opened</span>
              <Select
                value={views}
                onChange={setViews}
                options={VIEW_OPTIONS.map((value) => ({
                  value,
                  label: value === 1 ? "Once" : `${value} times`,
                }))}
              />
            </label>
          </div>

          <label className="send-link-field">
            <span>Passphrase (optional)</span>
            <Input.Password
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Needed to open the link"
              autoComplete="new-password"
            />
            <small>For extra safety, send the passphrase another way than the link.</small>
          </label>

          <label className="send-link-field">
            <span>Name for your list</span>
            <Input
              value={label}
              maxLength={100}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Wi-Fi password for Ana"
            />
            <small>Only you see this, in One-time links.</small>
          </label>
        </div>
      )}
    </Modal>
  );
};

export default SendLinkModal;
