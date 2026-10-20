import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ScanOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, Select, Switch, Tooltip, message } from "antd";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import ItemIcon from "../../components/itemIcon/ItemIcon";
import TotpCode from "../../components/totp/TotpCode";
import useTotp from "../../hooks/useTotp";
import {
  RECOVERY_FIELD_LABEL,
  isRecoveryLabel,
  normalizeRecoveryCodes,
  parseRecoveryCodes,
  recoverySummary,
} from "../../utils/recoveryCodes";
import { TOTP_FIELD_LABEL, isTotpLabel, readTotpQr } from "../../utils/totp";
import { CollectionItem, Note, useNoteStore } from "../../store/noteStore";
import {
  CARD_BRANDS,
  cardBrandFromFields,
  cardFieldKind,
  cardNumberPlaceholder,
  cvvPlaceholder,
  formatCardField,
  formatCardNumber,
  formatCvv,
  isAmexBrand,
} from "../../utils/cardField";
import { CATEGORY_ORDER, categoryKey, categoryLabel } from "../../utils/noteCategory";
import { isSecretField, noteBody, noteFields, type NoteField } from "../../utils/noteFields";

const { TextArea } = Input;

const generatePassword = (length = 20) => {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => chars[n % chars.length]).join("");
};

// Fields a new item starts with. [label, value] when the field has a usual default.
const TEMPLATES: Record<string, (string | [string, string])[]> = {
  password: ["Platform", "Username", "Email", "Password", "Key/Pass", "URL", TOTP_FIELD_LABEL],
  command: ["Command"],
  ssh: ["Host", ["Port", "22"], "Username", "Password", "SSH Key Path", "Connection String"],
  db: [["DB_HOST", "localhost"], ["DB_PORT", "5432"], "DB_USER", "DB_NAME", "DB_PASSWORD"],
  address: ["Full name", "Organization", "Email", "Phone", "Address", "Address 2", "City", "State", "Postal code", "Country"],
  card: ["Cardholder", "Brand", "Number", "Expires", "CVV", "PIN"],
};

const templateFields = (category: string): NoteField[] =>
  (TEMPLATES[category] || []).map((entry) =>
    Array.isArray(entry) ? { label: entry[0], value: entry[1] } : { label: entry, value: "" }
  );

// Generated passwords go into real password fields, not a PIN or CVV.
const isPasswordField = (label: string) => /pass/i.test(label);

// Under recovery codes: how many were read, so a bad paste shows at once.
const RecoveryHint = ({ value }: { value: string }) => {
  if (!value.trim()) {
    return (
      <span className="field-hint">
        Paste the codes, or load the .txt file the site gave you.
      </span>
    );
  }
  const codes = parseRecoveryCodes(value);
  if (!codes.length) {
    return <span className="field-hint is-error">No codes found. Put one code per line.</span>;
  }
  const { left, total } = recoverySummary(codes);
  return (
    <span className="field-hint">
      {total} {total === 1 ? "code" : "codes"}
      {left < total ? `, ${total - left} used` : ""}
    </span>
  );
};

// Under an authenticator key: the code it makes now, so it can be checked
// against the site, or why it can't be used.
const TotpHint = ({ value }: { value: string }) => {
  const { config, code, left, period } = useTotp(value);
  if (!value.trim()) {
    return <span className="field-hint">Paste the key the site shows, or scan its QR code.</span>;
  }
  if (!config) {
    return (
      <span className="field-hint is-error">
        Not a valid key. Use the text key or an otpauth:// link.
      </span>
    );
  }
  return (
    <span className="field-hint">
      Code now <TotpCode code={code} left={left} period={period} size="sm" />
    </span>
  );
};

interface NoteEditorProps {
  note?: Note | null;
  initialCategory?: string;
  collections: CollectionItem[];
  requireCollection?: boolean;
  defaultCollectionId?: number;
  // Fill the first password field with a fresh one (the "Change password" fix).
  freshPassword?: boolean;
  onCancel: () => void;
  onSaved: (note: Note) => void;
}

// Create or edit an item in place, in the detail pane.
const NoteEditor = ({
  note,
  initialCategory,
  collections,
  requireCollection,
  defaultCollectionId,
  freshPassword,
  onCancel,
  onSaved,
}: NoteEditorProps) => {
  const [form] = Form.useForm();
  const { createNote, updateNote } = useNoteStore();
  const [category, setCategory] = useState("note");
  const [fields, setFields] = useState<NoteField[]>([]);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const qrInput = useRef<HTMLInputElement>(null);
  const qrTarget = useRef<number | null>(null);
  const codesInput = useRef<HTMLInputElement>(null);
  const codesTarget = useRef<number | null>(null);
  const title = Form.useWatch("title", form) as string | undefined;

  useEffect(() => {
    if (note) {
      const key = categoryKey(note.category || "note");
      const existing = noteFields(note);
      const collectionIds = note.collections?.length
        ? note.collections.map((collection) => collection.id)
        : note.collectionId
          ? [note.collectionId]
          : [];
      form.setFieldsValue({
        title: note.title,
        category: key,
        collectionIds,
        content: noteBody(note),
        tags: note.tags || [],
        isFavorite: note.isFavorite,
      });
      setCategory(key);
      const passwordAt = freshPassword ? existing.findIndex((field) => isPasswordField(field.label)) : -1;
      setFields(
        existing.map((field, index) =>
          index === passwordAt ? { ...field, value: generatePassword() } : field
        )
      );
      setShown(passwordAt >= 0 ? new Set([passwordAt]) : new Set());
    } else {
      const key = categoryKey(initialCategory || "note");
      form.resetFields();
      form.setFieldsValue({
        category: key,
        collectionIds: defaultCollectionId ? [defaultCollectionId] : [],
      });
      setCategory(key);
      setFields(templateFields(key));
      setShown(new Set());
    }
    // Reset only when a different item (or a new one) opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, initialCategory, freshPassword]);

  const changeCategory = (value: string) => {
    setCategory(value);
    setFields(templateFields(value));
  };

  const updateField = (index: number, key: keyof NoteField, value: string) =>
    setFields((current) =>
      current.map((field, at) => (at === index ? { ...field, [key]: value } : field))
    );

  const setBrand = (brand: string) =>
    setFields((current) =>
      current.map((field) => {
        const kind = cardFieldKind(field.label);
        if (kind === "brand") return { ...field, value: brand };
        if (kind === "number") return { ...field, value: formatCardNumber(field.value, brand) };
        if (kind === "cvv") return { ...field, value: formatCvv(field.value, brand) };
        return field;
      })
    );

  const applyQrImage = async (index: number, file: Blob) => {
    try {
      updateField(index, "value", await readTotpQr(file));
      message.success("Authenticator key read from the QR code");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not read that image");
    }
  };

  const pasteQr = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const image = [...event.clipboardData.files].find((file) => file.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    applyQrImage(index, image);
  };

  const applyCodesFile = async (index: number, file: File) => {
    try {
      if (file.size > 100_000) throw new Error("That file is too large for recovery codes.");
      const text = await file.text();
      const codes = parseRecoveryCodes(text);
      if (!codes.length) throw new Error("No recovery codes found in that file.");
      updateField(index, "value", normalizeRecoveryCodes(text));
      toggleShown(index, true);
      message.success(`${codes.length} recovery codes loaded`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not read that file");
    }
  };

  const hasTotpField = fields.some((field) => isTotpLabel(field.label));
  const hasRecoveryField = fields.some((field) => isRecoveryLabel(field.label));

  const toggleShown = (index: number, visible: boolean) =>
    setShown((current) => {
      const next = new Set(current);
      if (visible) next.add(index);
      else next.delete(index);
      return next;
    });

  const canChooseCollection = !note || !!note.isOwner;
  const collectionOptions = collections
    .filter(
      (collection) =>
        collection.permission === "owner" ||
        collection.permission === "edit" ||
        note?.collections?.some((item) => item.id === collection.id) ||
        collection.id === note?.collectionId
    )
    .map((collection) => ({ value: collection.id, label: collection.name }));

  const save = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload: Record<string, unknown> = {
      ...values,
      content: { mainContent: values.content || "", customFields: fields },
    };
    if (canChooseCollection) payload.collectionIds = values.collectionIds || [];
    else delete payload.collectionIds;

    setSaving(true);
    try {
      const saved = note ? await updateNote(note.id, payload) : await createNote(payload);
      onSaved(saved);
    } catch {
      // The axios interceptor reports the error.
    } finally {
      setSaving(false);
    }
  };

  const brand = cardBrandFromFields(fields);
  const amex = isAmexBrand(brand);
  const preview = useMemo(
    () => ({ title: title || "", category, content: { customFields: fields } }),
    [title, category, fields]
  );

  return (
    <Form
      form={form}
      layout="vertical"
      className="detail-body editor"
      requiredMark={false}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          save();
        }
      }}
      initialValues={{ category: "note", isFavorite: false, tags: [] }}
    >
      <div className="detail-head">
        <ItemIcon note={preview} size="lg" />
        <div className="detail-title">
          <Form.Item
            name="title"
            rules={[{ required: true, message: "Give it a name" }]}
            style={{ marginBottom: 0 }}
          >
            <Input
              autoFocus={!note}
              className="title-input display-font"
              placeholder={`${categoryLabel(category)} name`}
              aria-label="Name"
            />
          </Form.Item>
        </div>
        <div className="detail-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Tooltip title="Ctrl + Enter">
            <Button type="primary" loading={saving} onClick={save}>
              {note ? "Save" : "Create"}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="editor-row">
        <Form.Item name="category" label="Category">
          <Select
            onChange={changeCategory}
            options={CATEGORY_ORDER.map((key) => ({ value: key, label: categoryLabel(key) }))}
          />
        </Form.Item>
        <Form.Item
          name="collectionIds"
          label="Collections"
          rules={
            requireCollection
              ? [
                  {
                    validator: (_, value) =>
                      Array.isArray(value) && value.length
                        ? Promise.resolve()
                        : Promise.reject(new Error("Choose a collection")),
                  },
                ]
              : undefined
          }
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="No collection"
            disabled={!canChooseCollection}
            options={collectionOptions}
          />
        </Form.Item>
      </div>

      <section className="fields-card" aria-label="Fields">
        {fields.map((field, index) => {
          const kind = cardFieldKind(field.label);
          const secret = isSecretField(field.label);
          const totp = isTotpLabel(field.label);
          const recovery = isRecoveryLabel(field.label);
          const value = formatCardField(field.label, field.value, "", brand);
          const onValue = (next: string) =>
            updateField(index, "value", formatCardField(field.label, next, field.value, brand));
          return (
            <div key={index} className={`field-row is-editing${totp || recovery ? " has-hint" : ""}`}>
              <Input
                className="field-label-input"
                placeholder="Field name"
                aria-label={`Field ${index + 1} name`}
                value={field.label}
                variant="borderless"
                onChange={(event) => updateField(index, "label", event.target.value)}
              />
              <div className="field-value-input">
                {kind === "brand" ? (
                  <Select
                    placeholder="Brand"
                    aria-label={field.label || "Brand"}
                    value={field.value || undefined}
                    style={{ width: "100%" }}
                    options={(field.value &&
                    !CARD_BRANDS.includes(field.value as (typeof CARD_BRANDS)[number])
                      ? [field.value, ...CARD_BRANDS]
                      : [...CARD_BRANDS]
                    ).map((item) => ({ value: item, label: item }))}
                    onChange={setBrand}
                  />
                ) : recovery && field.value && !shown.has(index) ? (
                  <Input
                    readOnly
                    className="mono recovery-masked"
                    aria-label={`${field.label || "Recovery codes"}, hidden. Click to show.`}
                    value={"•".repeat(16)}
                    onClick={() => toggleShown(index, true)}
                  />
                ) : recovery ? (
                  <TextArea
                    className="mono"
                    aria-label={field.label || `Field ${index + 1}`}
                    placeholder="One code per line"
                    autoSize={{ minRows: 3, maxRows: 10 }}
                    autoComplete="off"
                    spellCheck={false}
                    value={field.value}
                    onChange={(event) => updateField(index, "value", event.target.value)}
                    onBlur={() => updateField(index, "value", normalizeRecoveryCodes(field.value))}
                  />
                ) : secret ? (
                  <Input.Password
                    className="mono"
                    aria-label={field.label || `Field ${index + 1}`}
                    placeholder={
                      kind === "cvv"
                        ? cvvPlaceholder(brand)
                        : totp
                          ? "Key or otpauth:// link"
                          : "Value"
                    }
                    inputMode={kind === "cvv" ? "numeric" : undefined}
                    maxLength={kind === "cvv" ? (amex ? 4 : 3) : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    visibilityToggle={{
                      visible: shown.has(index),
                      onVisibleChange: (visible) => toggleShown(index, visible),
                    }}
                    onChange={(event) => onValue(event.target.value)}
                    onPaste={totp ? (event) => pasteQr(index, event) : undefined}
                  />
                ) : (
                  <Input
                    className={kind ? "mono" : undefined}
                    aria-label={field.label || `Field ${index + 1}`}
                    placeholder={
                      kind === "number"
                        ? cardNumberPlaceholder(brand)
                        : kind === "expires"
                          ? "MM/YY"
                          : "Value"
                    }
                    inputMode={kind ? "numeric" : undefined}
                    maxLength={kind === "number" ? (amex ? 17 : 19) : kind === "expires" ? 5 : undefined}
                    value={value}
                    onChange={(event) => onValue(event.target.value)}
                  />
                )}
                {totp && <TotpHint value={field.value} />}
                {recovery && <RecoveryHint value={field.value} />}
              </div>
              <div className="field-actions">
                {recovery && (
                  <>
                    <Tooltip title="Load from a .txt file">
                      <Button
                        type="text"
                        className="icon-btn"
                        aria-label="Load recovery codes from a .txt file"
                        icon={<FileTextOutlined />}
                        onClick={() => {
                          codesTarget.current = index;
                          codesInput.current?.click();
                        }}
                      />
                    </Tooltip>
                    {!!field.value && (
                      <Tooltip title={shown.has(index) ? "Hide codes" : "Show codes"}>
                        <Button
                          type="text"
                          className="icon-btn"
                          aria-label={shown.has(index) ? "Hide codes" : "Show codes"}
                          icon={shown.has(index) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                          onClick={() => toggleShown(index, !shown.has(index))}
                        />
                      </Tooltip>
                    )}
                  </>
                )}
                {totp && (
                  <Tooltip title="Scan a QR code from an image">
                    <Button
                      type="text"
                      className="icon-btn"
                      aria-label="Scan a QR code from an image"
                      icon={<ScanOutlined />}
                      onClick={() => {
                        qrTarget.current = index;
                        qrInput.current?.click();
                      }}
                    />
                  </Tooltip>
                )}
                {isPasswordField(field.label) && (
                  <Tooltip title="Generate a strong password">
                    <Button
                      type="text"
                      className="icon-btn"
                      aria-label="Generate a strong password"
                      icon={<SyncOutlined />}
                      onClick={() => {
                        updateField(index, "value", generatePassword());
                        toggleShown(index, true);
                      }}
                    />
                  </Tooltip>
                )}
                <Tooltip title="Remove field">
                  <Button
                    type="text"
                    className="icon-btn"
                    aria-label={`Remove ${field.label || "field"}`}
                    icon={<DeleteOutlined />}
                    onClick={() => setFields((current) => current.filter((_, at) => at !== index))}
                  />
                </Tooltip>
              </div>
            </div>
          );
        })}
        <div className="field-add-row">
          <button
            type="button"
            className="field-add"
            onClick={() => setFields((current) => [...current, { label: "", value: "" }])}
          >
            <PlusOutlined /> Add field
          </button>
          {category === "password" && !hasTotpField && (
            <button
              type="button"
              className="field-add"
              onClick={() =>
                setFields((current) => [...current, { label: TOTP_FIELD_LABEL, value: "" }])
              }
            >
              <PlusOutlined /> Authenticator key
            </button>
          )}
          {category === "password" && !hasRecoveryField && (
            <button
              type="button"
              className="field-add"
              onClick={() => {
                setFields((current) => [...current, { label: RECOVERY_FIELD_LABEL, value: "" }]);
                toggleShown(fields.length, true);
              }}
            >
              <PlusOutlined /> Recovery codes
            </button>
          )}
        </div>
        <input
          ref={qrInput}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            const index = qrTarget.current;
            event.target.value = "";
            if (file && index !== null) applyQrImage(index, file);
          }}
        />
        <input
          ref={codesInput}
          type="file"
          accept=".txt,text/plain"
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            const index = codesTarget.current;
            event.target.value = "";
            if (file && index !== null) applyCodesFile(index, file);
          }}
        />
      </section>

      <Form.Item
        name="content"
        label={fields.length ? "Notes" : "Content"}
        rules={fields.length ? [] : [{ required: true, message: "Write something" }]}
      >
        <TextArea
          autoSize={{ minRows: 3, maxRows: 14 }}
          placeholder={fields.length ? "Anything else worth keeping (optional)" : "Write your note…"}
        />
      </Form.Item>

      <Form.Item name="tags" label="Tags">
        <Select mode="tags" placeholder="Add tags, then press Enter" />
      </Form.Item>

      <div className="editor-switches">
        <Form.Item name="isFavorite" valuePropName="checked" label="Favorite">
          <Switch />
        </Form.Item>
      </div>
    </Form>
  );
};

export default NoteEditor;
