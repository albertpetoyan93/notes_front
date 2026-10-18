import {
  CloseOutlined,
  FilterOutlined,
  StarFilled,
  TeamOutlined,
} from "@ant-design/icons";
import { Checkbox, Input, Skeleton } from "antd";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import ItemIcon from "../../components/itemIcon/ItemIcon";
import type { Note } from "../../store/noteStore";
import { HEALTH_LABEL, healthIssues, noteSubtitle, type HealthKind } from "../../utils/noteFields";
import { categoryLabel } from "../../utils/noteCategory";
import { isNoteOwner } from "./NoteActions";

// Filters the open list. Typing waits a moment before it asks the server.
export const ListFilter = ({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => {
  const [text, setText] = useState(value);
  const timer = useRef<number>();

  useEffect(() => setText(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Input
      className="list-filter"
      allowClear
      prefix={<FilterOutlined />}
      placeholder={placeholder}
      aria-label="Filter this list"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onChange(next.trim()), 300);
      }}
      onPressEnter={() => {
        window.clearTimeout(timer.current);
        onChange(text.trim());
      }}
    />
  );
};

export const HealthSummary = ({
  logins,
  counts,
  flagged,
  active,
  onPick,
}: {
  logins: number;
  counts: Record<HealthKind, number>;
  flagged: number;
  active: string;
  onPick: (kind: HealthKind | null) => void;
}) => {
  const score = logins ? Math.round((100 * (logins - flagged)) / logins) : 100;
  return (
    <div className="health-summary">
      <div className="health-score">
        <span className="health-score-number display-font">{score}</span>
        <span className="health-score-label">/ 100 vault health</span>
      </div>
      <div
        className="health-bar"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Vault health"
      >
        <span style={{ width: `${score}%` }} />
      </div>
      <div className="health-tiles">
        {(["weak", "reused", "stale"] as HealthKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className={`health-tile is-${kind}${active === kind ? " is-active" : ""}`}
            aria-pressed={active === kind}
            onClick={() => onPick(active === kind ? null : kind)}
          >
            <span className="health-tile-count display-font">{counts[kind]}</span>
            <span className="health-tile-label">{HEALTH_LABEL[kind]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface ItemListProps {
  title: string;
  notes: Note[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: ReactNode;
  toolbar?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  emptyTitle: string;
  emptyText: string;
  selecting: boolean;
  checkedIds: number[];
  onCheck: (id: number, checked: boolean) => void;
  activeTag?: string;
  onClearTag?: () => void;
}

const ItemRowContent = ({ note }: { note: Note }) => {
  const issues = healthIssues(note);
  const subtitle = noteSubtitle(note) || categoryLabel(note.category);
  return (
    <>
      <ItemIcon note={note} />
      <span className="item-text">
        <span className="item-title">{note.title}</span>
        <span className="item-sub">{subtitle}</span>
      </span>
      <span className="item-meta">
        {issues[0] && <span className={`badge is-${issues[0]}`}>{HEALTH_LABEL[issues[0]]}</span>}
        {note.isShared && !note.collection?.companyId && (
          <TeamOutlined aria-label={`Shared by ${note.sharedByName || "someone"}`} />
        )}
        {note.isFavorite && <StarFilled className="favorite-on" aria-label="Favorite" />}
      </span>
    </>
  );
};

const ItemList = ({
  title,
  notes,
  loading,
  selectedId,
  onSelect,
  filter,
  toolbar,
  banner,
  footer,
  emptyTitle,
  emptyText,
  selecting,
  checkedIds,
  onCheck,
  activeTag,
  onClearTag,
}: ItemListProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Up and down move through the list, like a mail client.
  const onKeyDown = (event: KeyboardEvent) => {
    if (selecting || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const index = notes.findIndex((note) => note.id === selectedId);
    const next = notes[event.key === "ArrowDown" ? Math.min(index + 1, notes.length - 1) : Math.max(index - 1, 0)];
    if (!next) return;
    onSelect(next.id);
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus()
    );
  };

  return (
    <section className="list-pane" aria-label={title}>
      <div className="list-head">
        <div className="list-title-row">
          <h1 className="display-font">{title}</h1>
          <span className="list-count">
            {notes.length} {notes.length === 1 ? "item" : "items"}
          </span>
          <div className="list-toolbar">{toolbar}</div>
        </div>
        {filter}
        {activeTag && (
          <button type="button" className="chip is-accent filter-chip" onClick={onClearTag}>
            #{activeTag} <CloseOutlined aria-label="Clear tag" />
          </button>
        )}
      </div>
      {banner}
      <div className="list-rows" ref={listRef} onKeyDown={onKeyDown}>
        {loading && notes.length === 0 ? (
          <div aria-busy="true" aria-label="Loading items">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="item-row is-skeleton">
                <Skeleton.Avatar active shape="square" size={36} />
                <Skeleton active title={{ width: "55%" }} paragraph={{ rows: 1, width: "35%" }} />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="list-empty">
            <strong>{emptyTitle}</strong>
            <span>{emptyText}</span>
          </div>
        ) : (
          notes.map((note) => {
            const selected = note.id === selectedId;
            if (selecting) {
              const owner = isNoteOwner(note);
              const checked = checkedIds.includes(note.id);
              return (
                <label
                  key={note.id}
                  className={`item-row${checked ? " is-checked" : ""}${owner ? "" : " is-disabled"}`}
                  title={owner ? undefined : "Only the owner can move or delete this item"}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!owner}
                    onChange={(event) => onCheck(note.id, event.target.checked)}
                  />
                  <ItemRowContent note={note} />
                </label>
              );
            }
            return (
              <button
                key={note.id}
                type="button"
                data-id={note.id}
                className={selected ? "item-row is-selected" : "item-row"}
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(note.id)}
              >
                <ItemRowContent note={note} />
              </button>
            );
          })
        )}
      </div>
      {footer}
    </section>
  );
};

export default ItemList;
