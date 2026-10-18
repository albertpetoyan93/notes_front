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
  LeftOutlined,
  MinusCircleOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { ReactNode } from "react";
import ItemIcon from "../../components/itemIcon/ItemIcon";
import useFieldClipboard from "../../hooks/useFieldClipboard";
import type { Note } from "../../store/noteStore";
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
            {(note.tags || []).map((tag) => (
              <span key={tag} className="chip">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="detail-actions">
          {trash ? (
            owner && (
              <Button icon={<UndoOutlined />} onClick={onRestore}>
                Restore
              </Button>
            )
          ) : (
            <>
              <IconAction
                title={note.isFavorite ? "Remove from favorites" : "Add to favorites"}
                icon={note.isFavorite ? <StarFilled className="favorite-on" /> : <StarOutlined />}
                pressed={!!note.isFavorite}
                onClick={onFavorite}
              />
              {owner && <IconAction title="Share" icon={<ShareAltOutlined />} onClick={onShare} />}
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
                      onClick={() => clipboard.toggleVisible(key)}
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
                    onClick={() => clipboard.copy(shown, key, field.label)}
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
    </div>
  );
};

export default ItemDetail;
