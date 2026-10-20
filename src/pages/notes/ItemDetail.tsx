import {
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
  LeftOutlined,
  LogoutOutlined,
  MinusCircleOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  StarFilled,
  TeamOutlined,
  StarOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Badge, Button, Drawer, Modal, Tooltip, message } from "antd";
import { useState, type ReactNode } from "react";
import ActivityList from "../../components/activity/ActivityList";
import ItemIcon from "../../components/itemIcon/ItemIcon";
import { fetcherPost } from "../../configs/axios";
import TotpCode from "../../components/totp/TotpCode";
import useFieldClipboard, { type FieldClipboard } from "../../hooks/useFieldClipboard";
import useTotp from "../../hooks/useTotp";
import useVaultNav from "../../hooks/useVaultNav";
import { useCompanyStore } from "../../store/companyStore";
import type { Note } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { reportSecretUse } from "../../utils/activity";
import AccessPanel from "./AccessPanel";
import "./ItemDetail.scss";
import dayjsExtra from "../../utils/dayjs";
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
} from "../../utils/noteFields";
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
            clipboard.copy(code, key, "One-time code");
          }}
        />
      </div>
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
  const [accessOpen, setAccessOpen] = useState(false);
  const owner = isNoteOwner(note);
  const editable = canEditNote(note) && !trash;
  const fields = noteFields(note).filter((field) => field.value.trim());
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
    clipboard.copy(value, key, label);
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
