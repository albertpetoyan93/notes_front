import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LeftOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { Button, Empty, Modal, Spin, Tag, Tooltip, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { fetcherGet, fetcherPost } from "../../configs/axios";
import { useNoteStore, type Note } from "../../store/noteStore";
import { openVersions } from "../../utils/vaultItems";
import dayjsExtra from "../../utils/dayjs";
import { categoryLabel } from "../../utils/noteCategory";
import { isSecretField, maskValue, noteBody, noteFields, type NoteField } from "../../utils/noteFields";
import "./VersionHistory.scss";

interface VersionRow {
  id: number;
  createdAt: string;
  title: string;
  changes: string[];
  current: boolean;
  changedBy: { id: number; name: string } | null;
}

interface VersionDetail extends Omit<VersionRow, "current"> {
  category: string;
  tags: string[];
  content: Note["content"];
}

const when = (value: string) => dayjsExtra(value);

// Every saved state of an item, and a way to put an older one back.
const VersionHistory = ({
  note,
  onRestored,
}: {
  note: Note;
  onRestored: () => void;
}) => {
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<VersionDetail | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      // End-to-end items: the versions arrive sealed and are opened here.
      setVersions(await openVersions(note, await fetcherGet(`/api/notes/${note.id}/versions`)));
      setError("");
    } catch (loadError: any) {
      setError(loadError?.message || "Could not load the history");
    }
  }, [note]);

  useEffect(() => {
    load();
  }, [load]);

  const openVersion = async (row: VersionRow) => {
    setLoadingId(row.id);
    try {
      // An end-to-end version was opened with the list already.
      setOpen(note.e2e ? (row as unknown as VersionDetail) : await fetcherGet(`/api/notes/${note.id}/versions/${row.id}`));
      setShown(new Set());
    } catch (openError: any) {
      message.error(openError?.message || "Could not open that version");
    } finally {
      setLoadingId(null);
    }
  };

  const restore = (version: VersionDetail) =>
    Modal.confirm({
      title: "Restore this version?",
      content: `"${note.title}" goes back to how it was on ${when(version.createdAt).format(
        "D MMM YYYY, HH:mm"
      )}. The current version stays in the history, so you can undo this.`,
      okText: "Restore",
      onOk: async () => {
        try {
          if (note.e2e) {
            // Saved like an edit, sealed here: the server can't read the version.
            await useNoteStore.getState().updateNote(note.id, {
              title: version.title,
              content: version.content,
              tags: version.tags,
              category: version.category as Note["category"],
            });
          } else {
            await fetcherPost(`/api/notes/${note.id}/versions/${version.id}/restore`, {});
          }
          message.success("Version restored");
          setOpen(null);
          await load();
          onRestored();
        } catch (restoreError: any) {
          message.error(restoreError?.message || "Could not restore that version");
        }
      },
    });

  if (error) return <p className="version-error">{error}</p>;
  if (!versions) {
    return (
      <div className="version-loading">
        <Spin />
      </div>
    );
  }

  if (open) {
    const current = versions.find((row) => row.current);
    const isCurrent = current?.id === open.id;
    const fields = noteFields({ content: open.content }).filter((field) => field.value.trim());
    const now = noteFields(note);
    const changed = (field: NoteField) =>
      !now.some((item) => item.label === field.label && item.value === field.value);
    const body = noteBody({ content: open.content });

    return (
      <div className="version-detail">
        <Button type="text" icon={<LeftOutlined />} onClick={() => setOpen(null)}>
          All versions
        </Button>
        <div className="version-detail-head">
          <strong>{when(open.createdAt).format("D MMM YYYY, HH:mm")}</strong>
          <span>
            {open.changedBy ? `Saved by ${open.changedBy.name}` : "Before history was kept"}
            {isCurrent ? " · current version" : ""}
          </span>
        </div>

        <dl className="version-fields">
          <div className={open.title !== note.title ? "is-changed" : undefined}>
            <dt>Name</dt>
            <dd>{open.title}</dd>
          </div>
          {fields.map((field, index) => {
            const secret = isSecretField(field.label);
            const hidden = secret && !shown.has(index);
            return (
              <div key={`${field.label}-${index}`} className={changed(field) ? "is-changed" : undefined}>
                <dt>{field.label}</dt>
                <dd className={secret ? "mono" : undefined}>
                  {hidden ? maskValue(field, field.value) : field.value}
                  {secret && (
                    <Tooltip title={hidden ? "Show" : "Hide"}>
                      <Button
                        type="text"
                        size="small"
                        className="icon-btn"
                        aria-label={hidden ? `Show ${field.label}` : `Hide ${field.label}`}
                        icon={hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        onClick={() =>
                          setShown((set) => {
                            const next = new Set(set);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                      />
                    </Tooltip>
                  )}
                </dd>
              </div>
            );
          })}
          {body && (
            <div className={body !== noteBody(note) ? "is-changed" : undefined}>
              <dt>Notes</dt>
              <dd className="version-body">{body}</dd>
            </div>
          )}
          <div>
            <dt>Category</dt>
            <dd>{categoryLabel(open.category)}</dd>
          </div>
          {open.tags.length > 0 && (
            <div>
              <dt>Tags</dt>
              <dd>{open.tags.map((tag) => `#${tag}`).join(" ")}</dd>
            </div>
          )}
        </dl>
        <p className="version-legend">
          <span className="version-swatch" /> Different from the item now
        </p>

        {!isCurrent && (
          <Button type="primary" icon={<RollbackOutlined />} onClick={() => restore(open)} block>
            Restore this version
          </Button>
        )}
      </div>
    );
  }

  if (!versions.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No saved versions yet. Each time this item is saved, its previous state is kept here."
      />
    );
  }

  return (
    <div className="version-history">
      <p className="version-intro">
        Each save is kept here, so a mistaken change can be undone. The last 50 versions, for up
        to a year.
      </p>
      <ol className="version-list">
        {versions.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="version-row"
              onClick={() => openVersion(row)}
              disabled={loadingId !== null}
            >
              <span className="version-dot" aria-hidden="true" />
              <span className="version-main">
                <span className="version-when">
                  <Tooltip title={when(row.createdAt).format("D MMM YYYY, HH:mm")}>
                    <strong>{when(row.createdAt).fromNow()}</strong>
                  </Tooltip>
                  {row.current && <Tag color="purple">Current</Tag>}
                </span>
                <span className="version-who">
                  {row.changedBy ? row.changedBy.name : "Before history was kept"}
                </span>
                {row.changes.length > 0 && (
                  <span className="version-changes">
                    {row.changes.map((change) => (
                      <span key={change} className="version-change">
                        {change}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {loadingId === row.id && <Spin size="small" />}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default VersionHistory;
