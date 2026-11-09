import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Input,
  Progress,
  Select,
  Spin,
  message,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "../../configs/axios";
import { openNote } from "../../utils/vaultItems";
import {
  offboardingProgress,
  type TaskCounts,
  type TaskStatus,
} from "./offboardingProgress";

interface Offboarding {
  id: number;
  userId: number;
  memberEmail: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  counts: TaskCounts;
  keysRotated: boolean;
}

interface Task {
  id: number;
  noteId: number;
  status: TaskStatus;
  reference: string | null;
  note: string | null;
  actorId: number | null;
  updatedAt: string;
}

// What this viewer can learn about a task's item: a title if they can open it.
interface ItemInfo {
  title: string;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "not_required", label: "Not required" },
  { value: "failed", label: "Failed" },
];

const PAGE_SIZE = 100;
const NOTE_FETCHES = 10;

const OffboardingList = ({
  companyId,
  onOpen,
}: {
  companyId: number;
  onOpen: (item: Offboarding) => void;
}) => {
  const [rows, setRows] = useState<Offboarding[] | null>(null);

  useEffect(() => {
    axios
      .get(`/api/companies/${companyId}/offboardings`)
      .then((response) => setRows(response.data))
      .catch((error: any) => {
        message.error(error?.message || "Could not load offboardings");
        setRows([]);
      });
  }, [companyId]);

  if (!rows) {
    return (
      <div className="manage-empty">
        <Spin />
      </div>
    );
  }
  if (rows.length === 0)
    return <div className="manage-empty">Nobody has been offboarded.</div>;
  return (
    <ul className="manage-list">
      {rows.map((item) => {
        const progress = offboardingProgress(item.counts, item.keysRotated);
        return (
          <li key={item.id} className="manage-row">
            <span className="manage-icon is-person">
              {item.memberEmail.charAt(0).toUpperCase()}
            </span>
            <div className="manage-main">
              <strong>{item.memberEmail}</strong>
              <span>
                Started {new Date(item.startedAt).toLocaleDateString()} ·{" "}
                {progress.label}
              </span>
              <Progress
                percent={progress.percent}
                size="small"
                status={progress.complete ? "success" : "active"}
              />
            </div>
            <div className="manage-actions">
              <Button size="small" onClick={() => onOpen(item)}>
                Open
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const OffboardingDetail = ({
  companyId,
  offboarding,
  onBack,
}: {
  companyId: number;
  offboarding: Offboarding;
  onBack: () => void;
}) => {
  const [current, setCurrent] = useState(offboarding);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Record<number, ItemInfo>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // Only the newest page request may fill the screen.
  const latest = useRef(0);
  const base = `/api/companies/${companyId}/offboardings/${offboarding.id}`;

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setLoading(true);
    try {
      const data = (await axios.get(base, { params: { page } })).data;
      if (mine !== latest.current) return;
      setCurrent(data.offboarding);
      setTasks(data.tasks);
      setTotal(data.total);
      setSelected([]);
      // Titles come from this browser: an item the viewer can't open stays "An item".
      const found: Record<number, ItemInfo> = {};
      const fetchOne = async (task: Task) => {
        try {
          const raw = (await axios.get(`/api/notes/${task.noteId}`)).data;
          const opened = await openNote(raw);
          const readable = !opened.content?.decryptionFailed && opened.title;
          found[task.noteId] = {
            title: readable ? String(opened.title) : "An item",
          };
        } catch {
          // Trashed, or not reachable by this viewer.
          found[task.noteId] = { title: "An item" };
        }
      };
      // A few at a time, so a full page doesn't fire 100 requests at once.
      const queue = [...(data.tasks as Task[])];
      await Promise.all(
        Array.from({ length: NOTE_FETCHES }, async () => {
          for (let task = queue.shift(); task; task = queue.shift())
            await fetchOne(task);
        }),
      );
      if (mine !== latest.current) return;
      setItems(found);
    } catch (error: any) {
      message.error(error?.message || "Could not load the tasks");
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [base, page]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (
    taskIds: number[],
    status: TaskStatus,
    reference?: string,
  ) => {
    try {
      // The API needs the status on every call; a reference save passes the task's own.
      const body: Record<string, unknown> = { taskIds, status };
      if (reference !== undefined) body.reference = reference;
      const data = (await axios.patch(`${base}/tasks`, body)).data;
      setCurrent(data.offboarding);
      setTasks((list) =>
        list.map((task) =>
          taskIds.includes(task.id)
            ? {
                ...task,
                status,
                reference: reference !== undefined ? reference : task.reference,
              }
            : task,
        ),
      );
      setSelected([]);
    } catch (error: any) {
      message.error(error?.message || "Could not update");
    }
  };

  const progress = offboardingProgress(current.counts, current.keysRotated);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="manage-head">
        <div>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
            All offboardings
          </Button>
          <h1 className="display-font">{current.memberEmail}</h1>
          <p>
            Started {new Date(current.startedAt).toLocaleDateString()} ·{" "}
            {progress.label}
          </p>
          <Progress
            percent={progress.percent}
            status={progress.complete ? "success" : "active"}
          />
        </div>
      </div>
      <div className="manage-actions">
        <Button
          size="small"
          disabled={selected.length === 0}
          onClick={() => update(selected, "not_required")}
        >
          Mark not required{selected.length ? ` (${selected.length})` : ""}
        </Button>
        <Button
          size="small"
          type="link"
          onClick={() =>
            setSelected(
              selected.length === tasks.length
                ? []
                : tasks.map((task) => task.id),
            )
          }
        >
          {selected.length === tasks.length && tasks.length > 0
            ? "Clear selection"
            : "Select all on this page"}
        </Button>
      </div>
      {loading ? (
        <div className="manage-empty">
          <Spin />
        </div>
      ) : tasks.length === 0 ? (
        <Empty description="No tasks" />
      ) : (
        <ul className="manage-list">
          {tasks.map((task) => (
            <li key={task.id} className="manage-row">
              <input
                type="checkbox"
                aria-label="Select task"
                checked={selected.includes(task.id)}
                onChange={(event) =>
                  setSelected((list) =>
                    event.target.checked
                      ? [...list, task.id]
                      : list.filter((id) => id !== task.id),
                  )
                }
              />
              <div className="manage-main">
                <strong>{items[task.noteId]?.title || "An item"}</strong>
              </div>
              <div className="manage-actions">
                <Select
                  size="small"
                  style={{ width: 140 }}
                  value={task.status}
                  options={statusOptions}
                  onChange={(value) => update([task.id], value)}
                />
                <Input
                  size="small"
                  style={{ width: 200 }}
                  maxLength={200}
                  placeholder="Reference (ticket, link)"
                  value={drafts[task.id] ?? task.reference ?? ""}
                  onChange={(event) =>
                    setDrafts((map) => ({
                      ...map,
                      [task.id]: event.target.value,
                    }))
                  }
                  onBlur={() => {
                    const draft = drafts[task.id];
                    if (draft !== undefined && draft !== (task.reference ?? ""))
                      update([task.id], task.status, draft);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="manage-actions">
          <Button
            size="small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            size="small"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
};

/** Offboardings of people removed from the company: their open tasks. */
const OffboardingPanel = ({
  companyId,
  companyName,
}: {
  companyId: number;
  companyName: string;
}) => {
  const [open, setOpen] = useState<Offboarding | null>(null);
  if (open)
    return (
      <OffboardingDetail
        companyId={companyId}
        offboarding={open}
        onBack={() => setOpen(null)}
      />
    );
  return (
    <>
      <div className="manage-head">
        <div>
          <h1 className="display-font">Offboarding</h1>
          <p>
            People removed from {companyName}, and the passwords that still
            need changing. Access stops now. Anything they already saw or
            copied can't be taken back, so change those passwords at the source.
          </p>
        </div>
      </div>
      <OffboardingList companyId={companyId} onOpen={setOpen} />
    </>
  );
};

export default OffboardingPanel;
