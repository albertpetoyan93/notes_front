import {
  CheckCircleOutlined,
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOutlined,
  HistoryOutlined,
  KeyOutlined,
  LinkOutlined,
  LeftOutlined,
  LogoutOutlined,
  MinusCircleOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  StarFilled,
  TeamOutlined,
  StarOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Badge, Button, Drawer, Modal, Tooltip, message } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import ActivityList from "../../components/activity/ActivityList";
import ItemIcon from "../../components/itemIcon/ItemIcon";
import { fetcherPost } from "../../configs/axios";
import TotpCode from "../../components/totp/TotpCode";
import useFieldClipboard, { type FieldClipboard } from "../../hooks/useFieldClipboard";
import useTotp from "../../hooks/useTotp";
import useVaultNav from "../../hooks/useVaultNav";
import { useCompanyStore } from "../../store/companyStore";
import { useNoteStore, type Note } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { reportSecretUse } from "../../utils/activity";
import AccessPanel from "./AccessPanel";
import VersionHistory from "./VersionHistory";
import SendLinkModal from "../../components/secretLink/SendLinkModal";
import "./ItemDetail.scss";
import dayjsExtra from "../../utils/dayjs";
import { cardFieldKind } from "../../utils/cardField";
import { openURL } from "../../utils/isUrl";
import { categoryClass, categoryLabel } from "../../utils/noteCategory";
import {
  HEALTH_HELP,
  HEALTH_TITLE,
  decryptionFailed,
  displayValue,
  healthIssues,
  isSecretField,
  isUrlField,
  maskValue,
  noteBody,
  noteFields,
  notePasskeys,
  type NoteField,
} from "../../utils/noteFields";
import {
  formatRecoveryCodes,
  isRecoveryLabel,
  parseRecoveryCodes,
  recoverySummary,
} from "../../utils/recoveryCodes";
import { isTotpLabel, parseTotp } from "../../utils/totp";
import { canEditNote, isNoteOwner } from "./NoteActions";

interface ItemDetailProps {
  note: Note;
  trash: boolean;
  onBack: () => void;
  onEdit: () => void;
  onChangePassword: () => void;
  onFavorite: () => void;
  onShare: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onRemoveFromCollection?: () => void;
}

const IconAction = ({
  title,
  icon,
  onClick,
  pressed,
  danger,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  danger?: boolean;
}) => (
  <Tooltip title={title}>
    <Button
      type="text"
      className={danger ? "icon-btn is-danger" : "icon-btn"}
      aria-label={title}
      aria-pressed={pressed}
      icon={icon}
      onClick={onClick}
    />
  </Tooltip>
);

// An authenticator key, shown as the code it makes now. The key itself stays
// out of view; Edit shows it.
const TotpFieldRow = ({
  noteId,
  value,
  clipboard,
}: {
  noteId: number;
  value: string;
  clipboard: FieldClipboard;
}) => {
  const { code, left, period } = useTotp(value);
  const key = `${noteId}-totp`;
  const copied = clipboard.isCopied(key);
  return (
    <div className="field-row">
      <dt className="field-label">One-time code</dt>
      <dd className="field-value">
        <TotpCode code={code} left={left} period={period} />
      </dd>
      <div className="field-actions">
        <IconAction
          title={copied ? "Copied" : "Copy one-time code"}
          icon={copied ? <CheckOutlined className="field-copied" /> : <CopyOutlined />}
          onClick={() => {
            if (!code) return;
            reportSecretUse(noteId, "field_copied", "One-time code");
            clipboard.copy(code, key, "One-time code", true);
          }}
        />
      </div>
    </div>
  );
};

// Recovery codes: how many are left, and, once shown, each code with copy and
// a used mark (each works only once).
const RecoveryCodesRow = ({
  note,
  field,
  editable,
  clipboard,
  onSaved,
}: {
  note: Note;
  field: NoteField;
  editable: boolean;
  clipboard: FieldClipboard;
  onSaved: () => void;
}) => {
  const updateNote = useNoteStore((state) => state.updateNote);
  const [value, setValue] = useState(field.value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(field.value), [field.value]);

  const codes = parseRecoveryCodes(value);
  const { left, total } = recoverySummary(codes);
  const rowKey = `${note.id}-recovery-${field.label}`;
  const shown = clipboard.isVisible(rowKey);

  const toggleUsed = async (index: number) => {
    const nextValue = formatRecoveryCodes(
      codes.map((item, at) => (at === index ? { ...item, used: !item.used } : item))
    );
    const all = noteFields(note);
    const at = all.findIndex((item) => item.label === field.label && item.value === field.value);
    if (at < 0) return;
    const content = note.content && typeof note.content === "object" ? note.content : {};
    setValue(nextValue);
    setSaving(true);
    try {
      await updateNote(note.id, {
        content: {
          ...content,
          customFields: all.map((item, i) => (i === at ? { ...item, value: nextValue } : item)),
        },
      } as Partial<Note>);
      onSaved();
    } catch {
      setValue(field.value);
      message.error("Could not save the change");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="field-row recovery-row">
      <dt className="field-label">{field.label}</dt>
      <dd className="field-value">
        {total ? (
          <span className={`recovery-count${left <= 2 ? " is-low" : ""}`}>
            {left === 0
              ? `All ${total} used. Get new codes from the site.`
              : `${left} of ${total} left${left <= 2 ? ". Get new codes soon." : ""}`}
          </span>
        ) : (
          <span className="mono">{shown ? value : "••••••••"}</span>
        )}
      </dd>
      <div className="field-actions">
        <IconAction
          title={shown ? "Hide recovery codes" : "Show recovery codes"}
          icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          pressed={shown}
          onClick={() => {
            if (!shown) reportSecretUse(note.id, "field_revealed", field.label);
            clipboard.toggleVisible(rowKey);
          }}
        />
      </div>
      {shown && total > 0 && (
        <div className="recovery-panel">
          <ul className="recovery-list">
            {codes.map((item, index) => {
              const key = `${rowKey}-${index}`;
              const copied = clipboard.isCopied(key);
              return (
                <li key={item.code} className={item.used ? "is-used" : undefined}>
                  <span className="mono recovery-code">{item.code}</span>
                  {item.used && <span className="recovery-used">Used</span>}
                  <span className="recovery-actions">
                    {!item.used && (
                      <IconAction
                        title={copied ? "Copied" : "Copy code"}
                        icon={
                          copied ? <CheckOutlined className="field-copied" /> : <CopyOutlined />
                        }
                        onClick={() => {
                          reportSecretUse(note.id, "field_copied", field.label);
                          clipboard.copy(item.code, key, "Recovery code", true);
                        }}
                      />
                    )}
                    {editable && (
                      <IconAction
                        title={item.used ? "Mark as not used" : "Mark as used"}
                        icon={item.used ? <UndoOutlined /> : <CheckCircleOutlined />}
                        onClick={() => !saving && toggleUsed(index)}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="recovery-help">
            Each code works once. Mark a code as used after you sign in with it.
          </p>
        </div>
      )}
    </div>
  );
};

const ItemDetail = ({
  note,
  trash,
  onBack,
  onEdit,
  onChangePassword,
  onFavorite,
  onShare,
  onDelete,
  onRestore,
  onRemoveFromCollection,
}: ItemDetailProps) => {
  const clipboard = useFieldClipboard();
  const nav = useVaultNav();
  const companies = useCompanyStore((state) => state.companies);
  const refreshVault = useVaultStore((state) => state.refresh);
  const bumpList = useVaultStore((state) => state.bumpList);
  const [activityOpen, setActivityOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const owner = isNoteOwner(note);
  const editable = canEditNote(note) && !trash && !decryptionFailed(note);
  const fields = noteFields(note).filter((field) => field.value.trim());
  const passkeys = notePasskeys(note);
  const body = noteBody(note);
  const issues = trash ? [] : healthIssues(note);
  const collections = note.collections?.length
    ? note.collections
    : note.collection
      ? [note.collection]
      : [];
  const companyId = collections.find((collection) => collection.companyId)?.companyId ?? null;
  const companyRole = companyId
    ? companies.find((company) => company.id === companyId)?.role
    : undefined;
  // The API shows an item's history to its owner, and to company owners/admins.
  const canSeeActivity = companyId
    ? companyRole === "owner" || companyRole === "admin"
    : owner;
  // Shared with you on its own (not through a collection): you can drop it from
  // your list. Items from a shared collection leave with the collection.
  const sharedDirectly = !!(note as Note & { sharedDirectly?: boolean }).sharedDirectly;
  const canLeave = !owner && sharedDirectly && !companyId && !trash;
  // People besides the owner who can open it; sent to whoever manages access.
  const accessCount = (note as Note & { accessCount?: number }).accessCount;
  const peopleText = (count: number) =>
    `${count} ${count === 1 ? "person has" : "people have"} access`;

  const afterLeaving = () => {
    nav.selectItem(null);
    bumpList();
    refreshVault();
  };

  const leaveCollection = (collection: { id: number; name: string }) =>
    Modal.confirm({
      title: `Leave "${collection.name}"?`,
      content:
        "You stop seeing every item in this collection. The owner can share it with you again.",
      okText: "Leave collection",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherPost(`/api/collections/${collection.id}/leave`, {});
          message.success(`You left "${collection.name}"`);
          afterLeaving();
        } catch (err: any) {
          message.error(err?.message || "Could not leave the collection");
        }
      },
    });

  const leave = () =>
    Modal.confirm({
      title: "Remove from your list?",
      content: `${note.sharedByName || "The owner"} keeps "${note.title}". You stop seeing it, and they can share it with you again.`,
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await fetcherPost(`/api/notes/${note.id}/leave`, {});
          const via: { id: number; name: string }[] = result?.collections || [];
          if (via.length) {
            // Still visible through a shared collection: offer to leave that too.
            if (result.removed) bumpList();
            leaveCollection(via[0]);
            return;
          }
          message.success("Removed from your list");
          afterLeaving();
        } catch (err: any) {
          message.error(err?.message || "Could not remove the item");
        }
      },
    });

  const toggleSecret = (key: string, label: string) => {
    if (!clipboard.isVisible(key)) reportSecretUse(note.id, "field_revealed", label);
    clipboard.toggleVisible(key);
  };

  const copyField = (value: string, key: string, label: string, secret: boolean) => {
    if (secret) reportSecretUse(note.id, "field_copied", label);
    // Card numbers are shown, but still cleared from the clipboard.
    clipboard.copy(value, key, label, secret || cardFieldKind(label) === "number");
  };

  const edited = dayjsExtra(note.updatedAt);
  const created = dayjsExtra(note.createdAt);

  return (
    <div className="detail-body">
      <button type="button" className="detail-back phone-only" onClick={onBack}>
        <LeftOutlined /> Back
      </button>

      <div className="detail-head">
        <ItemIcon note={note} size="lg" />
        <div className="detail-title">
          <h2 className="display-font">{note.title}</h2>
          <div className="chips">
            <span className="chip">
              <span className={`nav-dot ${categoryClass(note.category)}`} />
              {categoryLabel(note.category)}
            </span>
            {collections.map((collection) => (
              <span key={collection.id} className="chip">
                <FolderOutlined />
                {collection.name}
              </span>
            ))}
            {note.isShared && !note.collection?.companyId && (
              <span className="chip is-accent">Shared by {note.sharedByName || "someone"}</span>
            )}
            {!!accessCount && !trash && (
              <button
                type="button"
                className="chip is-accent chip-button"
                onClick={() => setAccessOpen(true)}
              >
                <TeamOutlined />
                {peopleText(accessCount)}
              </button>
            )}
            {(note.tags || []).map((tag) => (
              <span key={tag} className="chip">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="detail-actions">
          {trash ? (
            <>
              {canSeeActivity && (
                <IconAction
                  title="Activity"
                  icon={<HistoryOutlined />}
                  onClick={() => setActivityOpen(true)}
                />
              )}
              {owner && (
                <Button icon={<UndoOutlined />} onClick={onRestore}>
                  Restore
                </Button>
              )}
            </>
          ) : (
            <>
              <IconAction
                title={note.isFavorite ? "Remove from favorites" : "Add to favorites"}
                icon={note.isFavorite ? <StarFilled className="favorite-on" /> : <StarOutlined />}
                pressed={!!note.isFavorite}
                onClick={onFavorite}
              />
              {owner && <IconAction title="Share" icon={<ShareAltOutlined />} onClick={onShare} />}
              {canSeeActivity && (
                <Badge
                  className="access-action"
                  count={accessCount || 0}
                  size="small"
                  offset={[-6, 6]}
                >
                  <IconAction
                    title={accessCount ? `Who has access (${accessCount})` : "Who has access"}
                    icon={<TeamOutlined />}
                    onClick={() => setAccessOpen(true)}
                  />
                </Badge>
              )}
              {canSeeActivity && (
                <IconAction
                  title="Activity"
                  icon={<HistoryOutlined />}
                  onClick={() => setActivityOpen(true)}
                />
              )}
              {editable && (
                <IconAction
                  title="Send as a one-time link"
                  icon={<LinkOutlined />}
                  onClick={() => setLinkOpen(true)}
                />
              )}
              {editable && (
                <IconAction
                  title="Version history"
                  icon={<RollbackOutlined />}
                  onClick={() => setVersionsOpen(true)}
                />
              )}
              {canLeave && (
                <IconAction
                  title="Remove from my list"
                  icon={<LogoutOutlined />}
                  onClick={leave}
                />
              )}
              {onRemoveFromCollection && (
                <IconAction
                  title="Remove from this collection"
                  icon={<MinusCircleOutlined />}
                  onClick={onRemoveFromCollection}
                />
              )}
              {owner && (
                <IconAction title="Move to Trash" icon={<DeleteOutlined />} onClick={onDelete} />
              )}
              {editable && (
                <Button icon={<EditOutlined />} onClick={onEdit}>
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {decryptionFailed(note) && (
        <div className="alert is-weak" role="alert">
          <ExclamationCircleOutlined className="alert-icon" />
          <div className="alert-copy">
            <strong>Could not decrypt this item</strong>
            <span>Its fields can't be shown. Try again later, or ask the owner to save it again.</span>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className={`alert is-${issues[0]}`}>
          <SafetyCertificateOutlined className="alert-icon" />
          <div className="alert-copy">
            <strong>{issues.map((kind) => HEALTH_TITLE[kind]).join(" · ")}</strong>
            <span>{HEALTH_HELP[issues[0]]}</span>
          </div>
          {editable && (
            <Button size="small" onClick={onChangePassword}>
              Change password
            </Button>
          )}
        </div>
      )}

      {fields.length > 0 && (
        <dl className="fields-card">
          {fields.map((field, index) => {
            if (isRecoveryLabel(field.label)) {
              return (
                <RecoveryCodesRow
                  key={`${note.id}-${index}`}
                  note={note}
                  field={field}
                  editable={editable}
                  clipboard={clipboard}
                  onSaved={bumpList}
                />
              );
            }
            if (isTotpLabel(field.label) && parseTotp(field.value)) {
              return (
                <TotpFieldRow
                  key={`${note.id}-${index}`}
                  noteId={note.id}
                  value={field.value}
                  clipboard={clipboard}
                />
              );
            }
            const key = `${note.id}-${index}`;
            const secret = isSecretField(field.label);
            const url = isUrlField(field);
            const shown = displayValue(field, fields);
            const hidden = secret && !clipboard.isVisible(key);
            const copied = clipboard.isCopied(key);
            return (
              <div key={key} className="field-row">
                <dt className="field-label">{field.label}</dt>
                <dd className={`field-value${secret ? " mono" : ""}${url ? " is-link" : ""}`}>
                  {hidden ? maskValue(field, shown) : shown}
                </dd>
                <div className="field-actions">
                  {secret && (
                    <IconAction
                      title={hidden ? `Show ${field.label}` : `Hide ${field.label}`}
                      icon={hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                      pressed={!hidden}
                      onClick={() => toggleSecret(key, field.label)}
                    />
                  )}
                  {url && (
                    <IconAction
                      title={`Open ${field.label}`}
                      icon={<ExportOutlined />}
                      onClick={() => openURL(field.value)}
                    />
                  )}
                  <IconAction
                    title={copied ? "Copied" : `Copy ${field.label}`}
                    icon={copied ? <CheckOutlined className="field-copied" /> : <CopyOutlined />}
                    onClick={() => copyField(shown, key, field.label, secret)}
                  />
                </div>
              </div>
            );
          })}
        </dl>
      )}

      {passkeys.length > 0 && (
        <section className="fields-card passkeys-card" aria-label="Passkeys">
          {passkeys.map((passkey) => (
            <div key={passkey.credentialId} className="passkey-row">
              <span className="passkey-icon" aria-hidden="true">
                <KeyOutlined />
              </span>
              <div className="passkey-text">
                <strong>Passkey for {passkey.rpId}</strong>
                <span>
                  {passkey.userDisplayName || passkey.userName || "No account name"}
                  {passkey.createdAt
                    ? ` · added ${dayjsExtra(passkey.createdAt).format("D MMM YYYY")}`
                    : ""}
                </span>
              </div>
              <Tooltip title="On that site, choose “Sign in with a passkey” and pick 2keevo. The key itself is never shown.">
                <span className="passkey-hint">Signs in with the extension</span>
              </Tooltip>
            </div>
          ))}
        </section>
      )}

      {body && (
        <section className="text-card">
          <div className="text-card-head">
            <span className="field-label">{fields.length ? "Notes" : "Content"}</span>
            <IconAction
              title={clipboard.isCopied(`${note.id}-body`) ? "Copied" : "Copy text"}
              icon={
                clipboard.isCopied(`${note.id}-body`) ? (
                  <CheckOutlined className="field-copied" />
                ) : (
                  <CopyOutlined />
                )
              }
              onClick={() => clipboard.copy(body, `${note.id}-body`, "Text")}
            />
          </div>
          <p>{body}</p>
        </section>
      )}

      {note.comment && (
        <section className="text-card">
          <span className="field-label">Comment</span>
          <p>{note.comment}</p>
        </section>
      )}

      <p className="detail-meta">
        <Tooltip title={edited.format("LLL")}>
          <time dateTime={edited.toISOString()}>Edited {edited.fromNow()}</time>
        </Tooltip>
        {" · "}
        <time dateTime={created.toISOString()}>Created {created.format("D MMM YYYY")}</time>
        {note.isEncrypted && " · Encrypted"}
      </p>

      <Drawer
        title={`Activity · ${note.title}`}
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        width={440}
        destroyOnClose
      >
        <ActivityList url={`/api/notes/${note.id}/activity`} withTitle={false} />
      </Drawer>

      <SendLinkModal open={linkOpen} note={note} onClose={() => setLinkOpen(false)} />

      <Drawer
        title={`Version history · ${note.title}`}
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        width={460}
        destroyOnClose
      >
        <VersionHistory
          note={note}
          onRestored={() => {
            bumpList();
            refreshVault();
          }}
        />
      </Drawer>

      <Drawer
        title={`Who has access · ${note.title}`}
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        width={460}
        destroyOnClose
      >
        <AccessPanel
          noteId={note.id}
          isOwner={owner}
          onAddPeople={() => {
            setAccessOpen(false);
            onShare();
          }}
          onChanged={bumpList}
        />
      </Drawer>
    </div>
  );
};

export default ItemDetail;
