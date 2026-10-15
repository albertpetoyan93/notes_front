import { Card, Checkbox, Tag, Tooltip, Typography } from "antd";
import CategoryDot from "../../components/noteCategory/CategoryDot";
import FieldActions from "../../components/noteField/FieldActions";
import PasswordHealthMark from "../../components/passwordHealth/PasswordHealthMark";
import PlatformIcon from "../../components/platformIcon/PlatformIcon";
import UpdatedAt from "../../components/updatedAt/UpdatedAt";
import useFieldClipboard from "../../hooks/useFieldClipboard";
import { Note } from "../../store/noteStore";
import { cardBrandFromFields, formatCardField } from "../../utils/cardField";
import { isURL } from "../../utils/isUrl";
import { categoryClass } from "../../utils/noteCategory";
import { isSecretField } from "../../utils/secretField";
import { buildNoteActions, isNoteOwner, type NoteActionHandlers } from "./NoteActions";
import "./NotesPage.scss";

const { Text, Paragraph } = Typography;

const customFields = (content: Note["content"]) => {
  if (typeof content === "object" && content !== null) {
    return (content as { customFields?: { label: string; value: string }[] }).customFields || [];
  }
  return [];
};

interface NoteCardProps extends NoteActionHandlers {
  note: Note;
  trash?: boolean;
  selected?: boolean;
  onView: (note: Note) => void;
  onToggleSelect?: (id: number, checked: boolean) => void;
}

const NoteCard = ({
  note,
  trash = false,
  selected = false,
  onView,
  onToggleSelect,
  ...handlers
}: NoteCardProps) => {
  const clipboard = useFieldClipboard();
  const fields = customFields(note.content).filter((field) => field.value);
  const cardBrand = cardBrandFromFields(fields);
  const collections = note.collections?.length
    ? note.collections
    : note.collection?.name
      ? [note.collection]
      : [];

  return (
    <Card
      className={`note-card ${categoryClass(note.category)}${selected ? " is-selected" : ""}`}
      hoverable
      onClick={() => onView(note)}
      actions={buildNoteActions(note, { trash, onView, ...handlers })}
    >
      <div className="note-card-header">
        <CategoryDot category={note.category} />
        <div className="note-card-badges">
          {note.isShared && !note.collection?.companyId && (
            <Tooltip title={`Shared by ${note.sharedByName || "someone"}`}>
              <Tag className="note-shared">{note.sharedByName || "Shared"}</Tag>
            </Tooltip>
          )}
          {collections.map((collection: { id: number; name: string }) => (
            <Tag key={collection.id} className="note-collection">
              {collection.name}
            </Tag>
          ))}
        </div>
      </div>

      <div className="note-title-row">
        {isNoteOwner(note) && !trash && onToggleSelect && (
          <Checkbox
            className="note-select"
            aria-label={`Select ${note.title}`}
            checked={selected}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToggleSelect(note.id, event.target.checked)}
          />
        )}
        <PlatformIcon note={note} />
        <h5 className="note-title">
          <button
            type="button"
            className="note-title-button"
            title={note.title}
            onClick={(event) => {
              event.stopPropagation();
              onView(note);
            }}
          >
            {note.title}
          </button>
        </h5>
        <PasswordHealthMark health={note.passwordHealth} />
      </div>

      {typeof note.content === "object" && note.content?.decryptionFailed && (
        <Text type="danger">Could not decrypt this note</Text>
      )}

      {fields.length > 0 && (
        <dl className="note-custom-fields">
          {fields.map((field, index) => {
            const fieldKey = `${note.id}-${index}`;
            const secret = isSecretField(field.label);
            const url = field.label.toLowerCase() === "url" && isURL(field.value);
            const shownValue = formatCardField(field.label, field.value, "", cardBrand);
            const hidden = secret && !clipboard.isVisible(fieldKey);
            return (
              <div key={index} className="custom-field-row">
                <dt className="field-label">{field.label}</dt>
                <dd className="field-value-container">
                  <Text
                    className={`field-value${hidden ? " is-secret" : ""}${url ? " is-url" : ""}`}
                    ellipsis={{ tooltip: hidden ? undefined : shownValue }}
                  >
                    {hidden ? "•".repeat(Math.min(shownValue.length, 12)) : shownValue}
                  </Text>
                  <FieldActions
                    fieldKey={fieldKey}
                    label={field.label}
                    value={shownValue}
                    secret={secret}
                    url={url}
                    clipboard={clipboard}
                  />
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {typeof note.content === "object" && note.content?.mainContent && (
        <div className="note-body">
          <Paragraph ellipsis={{ rows: 2 }} className="note-content">
            {note.content.mainContent}
          </Paragraph>
          <FieldActions
            fieldKey={`${note.id}-body`}
            label="Note"
            value={note.content.mainContent}
            clipboard={clipboard}
          />
        </div>
      )}

      {note.tags && note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.slice(0, 3).map((tag, index) => (
            <Tag key={index} className="note-tag">
              {tag}
            </Tag>
          ))}
          {note.tags.length > 3 && <Tag className="note-tag">+{note.tags.length - 3}</Tag>}
        </div>
      )}

      <UpdatedAt value={note.updatedAt} className="note-date" />
    </Card>
  );
};

export default NoteCard;
