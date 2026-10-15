import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MinusCircleOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { MouseEvent, ReactNode } from "react";
import type { Note } from "../../store/noteStore";

export interface NoteActionHandlers {
  onView?: (note: Note) => void;
  onEdit?: (note: Note) => void;
  onShare?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  onRestore?: (note: Note) => void;
  onFavorite?: (note: Note) => void;
  onRemoveFromCollection?: (note: Note) => void;
}

export const isNoteOwner = (note: Note) => note.isOwner === true || note.permission === "owner";

export const canEditNote = (note: Note) => isNoteOwner(note) || note.permission === "edit";

const stop = (event: MouseEvent) => event.stopPropagation();

// Favourite, view, share, edit, remove and delete, all visible in one row.
export const buildNoteActions = (
  note: Note,
  { trash = false, size, ...handlers }: NoteActionHandlers & { trash?: boolean; size?: "small" }
): ReactNode[] => {
  const owner = isNoteOwner(note);
  const button = (key: string, title: string, icon: ReactNode, onClick: () => void, extra = {}) => (
    <Tooltip key={key} title={title}>
      <Button
        type="text"
        size={size}
        aria-label={title}
        icon={icon}
        onClick={(event) => {
          stop(event);
          onClick();
        }}
        {...extra}
      />
    </Tooltip>
  );

  if (trash) {
    return [
      ...(handlers.onView
        ? [button("view", "View", <EyeOutlined />, () => handlers.onView?.(note))]
        : []),
      ...(owner && handlers.onRestore
        ? [button("restore", "Restore", <UndoOutlined />, () => handlers.onRestore?.(note))]
        : []),
    ];
  }

  const actions: ReactNode[] = [];

  if (handlers.onFavorite) {
    const title = note.isFavorite ? "Remove from favorites" : "Add to favorites";
    actions.push(
      button(
        "favorite",
        title,
        note.isFavorite ? <StarFilled className="favorite-on" /> : <StarOutlined />,
        () => handlers.onFavorite?.(note),
        { "aria-pressed": !!note.isFavorite }
      )
    );
  }
  if (handlers.onView) {
    actions.push(button("view", "View", <EyeOutlined />, () => handlers.onView?.(note)));
  }
  if (owner && handlers.onShare) {
    actions.push(button("share", "Share", <ShareAltOutlined />, () => handlers.onShare?.(note)));
  }
  if (canEditNote(note) && handlers.onEdit) {
    actions.push(button("edit", "Edit", <EditOutlined />, () => handlers.onEdit?.(note)));
  }
  if (handlers.onRemoveFromCollection) {
    actions.push(
      button("remove-collection", "Remove from collection", <MinusCircleOutlined />, () =>
        handlers.onRemoveFromCollection?.(note)
      )
    );
  }
  if (owner && handlers.onDelete) {
    actions.push(
      button("delete", "Move to trash", <DeleteOutlined />, () => handlers.onDelete?.(note), {
        danger: true,
      })
    );
  }

  return actions;
};
