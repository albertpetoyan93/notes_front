import { DeleteOutlined, DownloadOutlined, FileOutlined, LoadingOutlined, PaperClipOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Modal, Progress, Tooltip, message } from "antd";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import axiosServices, { fetcherDelete, fetcherGet, fetcherPost } from "../../configs/axios";
import { decryptFile, encryptedSize, encryptFile, openMeta, type AttachmentMeta } from "../../crypto/attachments";
import type { Note } from "../../store/noteStore";
import dayjsExtra from "../../utils/dayjs";
import { fileSize } from "../../utils/fileSize";
import { itemKeyOf } from "../../utils/vaultItems";

const MAX_BYTES = 100 * 1024 * 1024;

interface Row {
  id: string;
  size: number;
  encMeta: string;
  wrappedKey: string;
  createdAt: string;
}

interface SignedUrl {
  url: string;
  headers: Record<string, string>;
}

type Opened = Row & { meta: AttachmentMeta | null };

// Local storage (development) answers with links on this API; storage buckets with full URLs.
const absolute = (url: string) => (url.startsWith("/") ? `${String(axiosServices.defaults.baseURL || "").replace(/\/$/, "")}${url}` : url);

/** PUT with progress (fetch can't report upload progress). */
const upload = (target: SignedUrl, body: Blob, onProgress: (percent: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", absolute(target.url));
    Object.entries(target.headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload failed. Try again.")));
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.send(body);
  });

/**
 * An item's files: encrypted here with a key wrapped by the item's key, uploaded straight
 * to storage, and decrypted here on download. Shown for end-to-end items.
 */
const AttachmentsCard = ({ note, editable }: { note: Note; editable: boolean }) => {
  const [files, setFiles] = useState<Opened[] | null>(null);
  const [uploading, setUploading] = useState<{ name: string; percent: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const rows: Row[] = await fetcherGet(`/api/attachments/note/${note.id}`);
      const key = rows.length ? await itemKeyOf(note) : null;
      const opened = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          meta: key ? await openMeta(key, String(note.e2eId), row.id, row.wrappedKey, row.encMeta).catch(() => null) : null,
        }))
      );
      setFiles(opened);
    } catch {
      setFiles([]);
    }
  }, [note]);

  useEffect(() => {
    setFiles(null);
    load();
  }, [load]);

  const add = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        message.error(`${file.name} is over 100 MB.`);
        continue;
      }
      setUploading({ name: file.name, percent: 0 });
      try {
        const key = await itemKeyOf(note);
        const { id, upload: target } = await fetcherPost(`/api/attachments/note/${note.id}`, { size: encryptedSize(file.size) });
        const sealed = await encryptFile(key, String(note.e2eId), id, file, file.name);
        await upload(target, sealed.body, (percent) => setUploading({ name: file.name, percent }));
        await fetcherPost(`/api/attachments/${id}/done`, { encMeta: sealed.encMeta, wrappedKey: sealed.wrappedKey });
        message.success(`${file.name} added`);
      } catch (error: any) {
        // Storage limits open the upgrade prompt on their own.
        if (error?.code !== "plan_limit") message.error(error?.message || `Could not add ${file.name}`);
        break;
      } finally {
        setUploading(null);
      }
    }
    await load();
  };

  const download = async (file: Opened) => {
    setBusy(`get-${file.id}`);
    try {
      const target: SignedUrl = await fetcherGet(`/api/attachments/${file.id}/download`);
      const response = await fetch(absolute(target.url));
      if (!response.ok) throw new Error("The file couldn't be downloaded.");
      const blob = await decryptFile(
        await itemKeyOf(note),
        String(note.e2eId),
        file.id,
        file.wrappedKey,
        await response.arrayBuffer(),
        file.meta?.type
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.meta?.name || "file";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error: any) {
      message.error(error?.message === "decrypt-failed" ? "This file can't be opened: it was changed or damaged." : error?.message || "Could not open the file");
    } finally {
      setBusy(null);
    }
  };

  const remove = (file: Opened) =>
    Modal.confirm({
      title: `Delete ${file.meta?.name || "this file"}?`,
      content: "It's deleted for everyone who can open this item. Version history doesn't keep files.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherDelete(`/api/attachments/${file.id}`);
          message.success("File deleted");
          await load();
        } catch (error: any) {
          message.error(error?.message || "Could not delete the file");
        }
      },
    });

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (editable && !uploading && event.dataTransfer.files.length) add(event.dataTransfer.files);
  };

  if (!files) return null;
  if (!files.length && !editable) return null;

  return (
    <section
      className={`fields-card attachments-card${dragging ? " is-dragging" : ""}`}
      aria-label="Files"
      onDragOver={(event) => {
        if (!editable) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="attachments-head">
        <span className="field-label">
          <PaperClipOutlined /> Files{files.length ? ` (${files.length})` : ""}
        </span>
        {editable && (
          <Button size="small" icon={<PlusOutlined />} disabled={!!uploading} onClick={() => input.current?.click()}>
            Add file
          </Button>
        )}
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files?.length) add(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {files.map((file) => (
        <div key={file.id} className="attachment-row">
          <span className="attachment-icon" aria-hidden="true">
            <FileOutlined />
          </span>
          <div className="attachment-text">
            <strong>{file.meta?.name || "File can't be opened"}</strong>
            <span>
              {fileSize(file.meta?.size ?? file.size)} · added {dayjsExtra(file.createdAt).format("D MMM YYYY")}
            </span>
          </div>
          <Tooltip title="Download">
            <Button
              type="text"
              size="small"
              aria-label={`Download ${file.meta?.name || "file"}`}
              icon={busy === `get-${file.id}` ? <LoadingOutlined /> : <DownloadOutlined />}
              disabled={!file.meta || busy === `get-${file.id}`}
              onClick={() => download(file)}
            />
          </Tooltip>
          {editable && (
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                aria-label={`Delete ${file.meta?.name || "file"}`}
                icon={<DeleteOutlined />}
                onClick={() => remove(file)}
              />
            </Tooltip>
          )}
        </div>
      ))}

      {uploading && (
        <div className="attachment-row is-uploading">
          <span className="attachment-icon" aria-hidden="true">
            <LoadingOutlined />
          </span>
          <div className="attachment-text">
            <strong>{uploading.name}</strong>
            <Progress percent={uploading.percent} size="small" showInfo={false} />
          </div>
        </div>
      )}

      {editable && !files.length && !uploading && (
        <p className="attachments-empty">Drop files here, up to 100 MB each. They're encrypted before they leave this device.</p>
      )}
    </section>
  );
};

export default AttachmentsCard;
