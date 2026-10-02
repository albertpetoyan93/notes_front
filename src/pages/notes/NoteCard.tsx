import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, Card, Checkbox, Tag, Tooltip, Typography, message } from "antd";
import { useState } from "react";
import PlatformIcon from "../../components/platformIcon/PlatformIcon";
import { Note } from "../../store/noteStore";
import dayjsExtra from "../../utils/dayjs";
import "./NotesPage.scss";

const { Title, Text, Paragraph } = Typography;

const passwordHealthTip = (health: {
  weak: boolean;
  reused: boolean;
  stale: boolean;
}) =>
  [
    health.weak && "Weak password",
    health.reused && "Reused password",
    health.stale && "Not updated in 6 months",
  ]
    .filter(Boolean)
    .join(" · ");

const PasswordHealthMark = ({
  health,
}: {
  health?: { weak: boolean; reused: boolean; stale: boolean };
}) => {
  if (!health) return null;
  const color = health.weak ? "#ff4d4f" : health.reused ? "#fa8c16" : "#faad14";
  return (
    <Tooltip title={passwordHealthTip(health)}>
      <span className="password-health-mark" style={{ color }}>
        <WarningOutlined />
      </span>
    </Tooltip>
  );
};

const isURL = (value: unknown) => {
  if (!value) return false;
  const strValue = String(value);
  try {
    const url = new URL(strValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    if (strValue.includes(".") && !strValue.includes(" ")) {
      try {
        new URL(`http://${strValue}`);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
};

const openURL = (value: unknown) => {
  const strValue = String(value);
  const url =
    strValue.startsWith("http://") || strValue.startsWith("https://")
      ? strValue
      : `http://${strValue}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

const customFields = (content: Note["content"]) => {
  if (typeof content === "object" && content !== null) {
    return (content as { customFields?: { label: string; value: string }[] }).customFields || [];
  }
  return [];
};

interface NoteCardProps {
  note: Note;
  trash?: boolean;
  selected?: boolean;
  onView: (note: Note) => void;
  onEdit?: (note: Note) => void;
  onShare?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  onRestore?: (note: Note) => void;
  onFavorite?: (note: Note) => void;
  onRemoveFromCollection?: (note: Note) => void;
  onToggleSelect?: (id: number, checked: boolean) => void;
}

const NoteCard = ({
  note,
  trash = false,
  selected = false,
  onView,
  onEdit,
  onShare,
  onDelete,
  onRestore,
  onFavorite,
  onRemoveFromCollection,
  onToggleSelect,
}: NoteCardProps) => {
  const [copiedFields, setCopiedFields] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const isOwner = note.isOwner === true || note.permission === "owner";
  const canEdit = isOwner || note.permission === "edit";

  const copyToClipboard = (text: string, fieldKey: string, label?: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedFields((prev) => new Set(prev).add(fieldKey));
        window.setTimeout(() => {
          setCopiedFields((prev) => {
            const next = new Set(prev);
            next.delete(fieldKey);
            return next;
          });
        }, 2000);
        message.success(`${label || "Text"} copied!`, 1.5);
      },
      () => {
        message.error("Failed to copy to clipboard");
      }
    );
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  return (
    <Card
      className="note-card"
      hoverable
      onClick={() => onView(note)}
      style={{ cursor: "pointer" }}
      actions={[
        ...(!trash && onFavorite
          ? [
              <Button
                key="favorite"
                type="text"
                icon={
                  note.isFavorite ? (
                    <StarFilled style={{ color: "#faad14" }} />
                  ) : (
                    <StarOutlined />
                  )
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onFavorite(note);
                }}
              />,
            ]
          : []),
        <Button
          key="view"
          type="text"
          icon={<EyeOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            onView(note);
          }}
        />,
        ...(isOwner && onShare
          ? [
              <Button
                key="share"
                type="text"
                icon={<ShareAltOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onShare(note);
                }}
              />,
            ]
          : []),
        ...(canEdit && onEdit
          ? [
              <Button
                key="edit"
                type="text"
                icon={<EditOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(note);
                }}
              />,
            ]
          : []),
        ...(onRemoveFromCollection
          ? [
              <Tooltip key="remove-collection" title="Remove from collection">
                <Button
                  type="text"
                  icon={<MinusCircleOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFromCollection(note);
                  }}
                />
              </Tooltip>,
            ]
          : []),
        ...(isOwner && (trash ? onRestore : onDelete)
          ? [
              trash ? (
                <Button
                  key="restore"
                  type="text"
                  icon={<UndoOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRestore?.(note);
                  }}
                />
              ) : (
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete?.(note);
                  }}
                />
              ),
            ]
          : []),
      ]}
    >
      <div className="note-card-header">
        <Tag
          className={`note-category note-category-${
            note.category === "login" ? "password" : note.category
          }`}
        >
          {note.category === "password" || note.category === "login"
            ? "LOGIN"
            : note.category.toUpperCase()}
        </Tag>
        {note.isShared && !note.collection?.companyId && (
          <Tooltip title={`Shared by ${note.sharedByName || "someone"}`}>
            <Tag color="purple">{note.sharedByName || "Shared"}</Tag>
          </Tooltip>
        )}
        {(note.collections?.length
          ? note.collections
          : note.collection?.name
            ? [note.collection]
            : []
        ).map((collection: { id: number; name: string }) => (
          <Tag key={collection.id} className="note-collection">
            {collection.name}
          </Tag>
        ))}
        {note.isFavorite && <StarFilled style={{ color: "#faad14", fontSize: 16 }} />}
      </div>
      <div className="note-title-row">
        {isOwner && !trash && onToggleSelect && (
          <Checkbox
            className="note-select"
            checked={selected}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToggleSelect(note.id, event.target.checked)}
          />
        )}
        <PlatformIcon note={note} />
        <Title level={5} ellipsis={{ rows: 1 }} className="note-title">
          {note.title}
        </Title>
        <PasswordHealthMark health={note.passwordHealth} />
      </div>
      {typeof note.content === "object" && note.content?.decryptionFailed && (
        <Text type="danger">Could not decrypt this note</Text>
      )}
      {customFields(note.content).length > 0 && (
        <div className="note-custom-fields">
          {customFields(note.content).map((field, index) => {
            const fieldKey = `${note.id}-${index}`;
            const isCopied = copiedFields.has(fieldKey);
            const isUrlField = field.label.toLowerCase() === "url" && isURL(field.value);
            const isPasswordField =
              field.label.toLowerCase().includes("password") ||
              field.label.toLowerCase().includes("pass");
            const showPassword = visiblePasswords.has(fieldKey);
            if (!field.value) return null;
            const displayValue =
              isPasswordField && !showPassword
                ? "•".repeat(Math.min(field.value.length, 12))
                : field.value;
            return (
              <div
                key={index}
                className={`custom-field-row ${isCopied ? "copied" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  copyToClipboard(field.value, fieldKey, field.label);
                }}
              >
                <Text type="secondary" className="field-label">
                  {field.label}:
                </Text>
                <div className="field-value-container">
                  <Text
                    className="field-value"
                    ellipsis={{ tooltip: field.value }}
                    style={{
                      color: isUrlField ? "var(--colorInfo)" : undefined,
                      textDecoration: isUrlField ? "underline" : undefined,
                      marginLeft: 6,
                      fontFamily: isPasswordField && !showPassword ? "monospace" : undefined,
                      letterSpacing: isPasswordField && !showPassword ? "2px" : undefined,
                    }}
                  >
                    {displayValue}
                  </Text>
                  <div className="field-actions">
                    {isPasswordField && (
                      <Tooltip title={showPassword ? "Hide value" : "Show value"}>
                        {showPassword ? (
                          <EyeInvisibleOutlined
                            className="password-toggle-icon"
                            style={{ color: "var(--iconMuted)", fontSize: 12 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePasswordVisibility(fieldKey);
                            }}
                          />
                        ) : (
                          <EyeOutlined
                            className="password-toggle-icon"
                            style={{ color: "var(--iconMuted)", fontSize: 12 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePasswordVisibility(fieldKey);
                            }}
                          />
                        )}
                      </Tooltip>
                    )}
                    {isUrlField && (
                      <Tooltip title="Open URL">
                        <LinkOutlined
                          className="link-icon"
                          style={{ color: "var(--colorInfo)", fontSize: 12, marginLeft: 4 }}
                          onClick={(event) => {
                            event.stopPropagation();
                            openURL(field.value);
                          }}
                        />
                      </Tooltip>
                    )}
                    {!isPasswordField &&
                      (isCopied ? (
                        <CheckOutlined
                          className="check-icon"
                          style={{ color: "#52c41a", fontSize: 14 }}
                        />
                      ) : (
                        <Tooltip title="Click to copy">
                          <CopyOutlined className="copy-icon" />
                        </Tooltip>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {typeof note.content === "object" && note.content?.mainContent && (
        <Paragraph ellipsis={{ rows: 2 }} className="note-content" style={{ marginTop: 8 }}>
          {note.content.mainContent}
        </Paragraph>
      )}
      {note.tags && note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.slice(0, 3).map((tag, index) => (
            <Tag key={index} className="note-tag">
              {tag}
            </Tag>
          ))}
        </div>
      )}
      <Text type="secondary" className="note-date">
        {dayjsExtra(note.updatedAt).format("DD/MM/YYYY")}
      </Text>
    </Card>
  );
};

export default NoteCard;
