import {
  CheckOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  InboxOutlined,
  KeyOutlined,
  LogoutOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { Button, Modal, Select, Tooltip, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetcherPost } from "../../configs/axios";
import useVaultNav from "../../hooks/useVaultNav";
import { Note, useNoteStore } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { categoryPlural } from "../../utils/noteCategory";
import {
  healthIssues,
  searchText,
  type HealthKind,
} from "../../utils/noteFields";
import CollectionDialogs from "./CollectionDialogs";
import ItemDetail from "./ItemDetail";
import ItemList, { HealthSummary, ListFilter } from "./ItemList";
import { isNoteOwner } from "./NoteActions";
import NoteEditor from "./NoteEditor";
import ShareModal from "./ShareModal";
import "./NotesPage.scss";

const PHONE = "(max-width: 820px)";

const usePhone = () => {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const onChange = () => setPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return phone;
};

// Moving to trash can be undone, so it acts at once and offers Undo instead of asking first.
const undoToast = (text: string, undo: () => Promise<void>) => {
  const key = `undo-${Date.now()}`;
  message.open({
    key,
    type: "success",
    duration: 6,
    content: (
      <span className="undo-toast">
        {text}
        <Button
          type="link"
          size="small"
          onClick={async () => {
            message.destroy(key);
            try {
              await undo();
            } catch {
              message.error("Could not undo");
            }
          }}
        >
          Undo
        </Button>
      </span>
    ),
  });
};

const HEALTH_ORDER: HealthKind[] = ["weak", "reused", "stale"];
const severity = (note: Note) => {
  const first = healthIssues(note)[0];
  return first ? HEALTH_ORDER.indexOf(first) : HEALTH_ORDER.length;
};

const NotesPage = ({ companyId }: { companyId?: number }) => {
  const nav = useVaultNav();
  const {
    notes,
    loading,
    fetchNotes,
    deleteNote,
    restoreNote,
    toggleFavorite,
    addNotesToCollection,
    removeNoteFromCollection,
    emptyTrash,
    bulkUpdateNotes,
  } = useNoteStore();
  const summary = useVaultStore((state) => state.summary);
  const collections = useVaultStore((state) => state.collections);
  const refreshVault = useVaultStore((state) => state.refresh);
  const listVersion = useVaultStore((state) => state.listVersion);
  const setImportOpen = useVaultStore((state) => state.setImportOpen);
  const phone = usePhone();

  const [editing, setEditing] = useState<{
    id: number;
    freshPassword: boolean;
  } | null>(null);
  const [sharingNote, setSharingNote] = useState<Note | null>(null);
  const [collectionShareOpen, setCollectionShareOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [bulkCollection, setBulkCollection] = useState<string>();

  const isHealth = nav.view === "health";
  const isTrash = nav.view === "trash";
  const activeCollection =
    collections.find(
      (collection) => String(collection.id) === nav.collection,
    ) || null;

  const fetchList = useCallback(async () => {
    // Security health is worked out from the whole vault, which the shell already holds.
    if (isHealth) return;
    await fetchNotes({
      category: nav.category || undefined,
      tag: nav.tag || undefined,
      search: nav.search || undefined,
      sharedOnly: nav.view === "shared",
      trash: isTrash,
      isFavorite: nav.view === "favorites",
      collectionId: nav.collection ? Number(nav.collection) : undefined,
      companyId,
    });
  }, [
    fetchNotes,
    isHealth,
    isTrash,
    nav.category,
    nav.tag,
    nav.search,
    nav.view,
    nav.collection,
    companyId,
  ]);

  useEffect(() => {
    fetchList();
  }, [fetchList, listVersion]);

  useEffect(() => {
    setSelecting(false);
    setCheckedIds([]);
  }, [nav.view, nav.category, nav.collection, nav.tag, companyId]);

  const afterChange = useCallback(async () => {
    await fetchList();
    refreshVault();
  }, [fetchList, refreshVault]);

  const healthCounts = useMemo(() => {
    const counts: Record<HealthKind, number> = { weak: 0, reused: 0, stale: 0 };
    summary.forEach((note) =>
      healthIssues(note).forEach((kind) => (counts[kind] += 1)),
    );
    return counts;
  }, [summary]);

  const list = useMemo(() => {
    if (isHealth) {
      const query = nav.search.toLowerCase();
      return summary
        .filter((note) => {
          const issues = healthIssues(note);
          if (!issues.length) return false;
          if (nav.health !== "1" && !issues.includes(nav.health as HealthKind))
            return false;
          return !query || searchText(note).includes(query);
        })
        .sort((a, b) => severity(a) - severity(b));
    }
    return nav.view === "favorites"
      ? notes.filter((note) => note.isFavorite)
      : notes;
  }, [isHealth, nav.search, nav.health, nav.view, summary, notes]);

  const explicit = nav.item
    ? list.find((note) => note.id === nav.item) ||
      notes.find((note) => note.id === nav.item) ||
      summary.find((note) => note.id === nav.item) ||
      null
    : null;
  // On a wide screen the first item opens by itself; on a phone the list comes first.
  const selected = nav.newCategory
    ? null
    : explicit || (phone ? null : list[0] || null);

  useEffect(() => {
    setEditing(null);
  }, [selected?.id, nav.newCategory]);

  const detailOpen = !!nav.newCategory || !!nav.item;

  const handleFavorite = async (note: Note) => {
    try {
      await toggleFavorite(note.id);
      refreshVault();
    } catch {
      message.error("Could not update favorites");
    }
  };

  const handleDelete = async (note: Note) => {
    try {
      await deleteNote(note.id);
      if (nav.item === note.id) nav.selectItem(null);
      refreshVault();
      undoToast(`“${note.title}” moved to Trash`, async () => {
        await restoreNote(note.id);
        await afterChange();
      });
    } catch {
      message.error("Could not move it to Trash");
    }
  };

  const handleRestore = async (note: Note) => {
    try {
      await restoreNote(note.id);
      nav.selectItem(null);
      refreshVault();
      message.success(`“${note.title}” restored`);
    } catch {
      message.error("Could not restore it");
    }
  };

  const handleRemoveFromCollection = async (note: Note) => {
    if (!activeCollection) return;
    const collection = activeCollection;
    try {
      await removeNoteFromCollection(collection.id, note.id);
      nav.selectItem(null);
      await afterChange();
      undoToast(`Removed from ${collection.name}`, async () => {
        await addNotesToCollection(collection.id, [note.id]);
        await afterChange();
      });
    } catch (error: any) {
      message.error(error?.message || "Could not remove it");
    }
  };

  // Emptying the trash is permanent, so it asks first.
  const handleEmptyTrash = () => {
    Modal.confirm({
      title: "Empty Trash?",
      content: "This permanently deletes every item in the Trash.",
      okText: "Delete permanently",
      okButtonProps: { danger: true },
      onOk: async () => {
        const deleted = await emptyTrash();
        message.success(
          deleted === 1 ? "Deleted 1 item" : `Deleted ${deleted} items`,
        );
        nav.selectItem(null);
        afterChange();
      },
    });
  };

  const finishBulk = async (result: { updated: number; skipped: number }) => {
    setCheckedIds([]);
    setSelecting(false);
    setBulkCollection(undefined);
    await afterChange();
    if (result.skipped) {
      message.warning(
        `Updated ${result.updated}. Skipped ${result.skipped} you do not own.`,
      );
    } else {
      message.success(
        result.updated === 1
          ? "Updated 1 item"
          : `Updated ${result.updated} items`,
      );
    }
  };

  const handleBulkMove = async () => {
    if (!bulkCollection || !checkedIds.length) return;
    try {
      const result = await bulkUpdateNotes(
        checkedIds,
        "move",
        bulkCollection === "none" ? null : Number(bulkCollection),
      );
      await finishBulk(result);
    } catch (error: any) {
      message.error(error?.message || "Could not move the items");
    }
  };

  const handleBulkTrash = async () => {
    const ids = [...checkedIds];
    try {
      const result = await bulkUpdateNotes(ids, "trash");
      setCheckedIds([]);
      setSelecting(false);
      await afterChange();
      const moved = result.updated === 1 ? "1 item" : `${result.updated} items`;
      undoToast(
        `Moved ${moved} to Trash${result.skipped ? `. Skipped ${result.skipped} you do not own` : ""}`,
        async () => {
          await Promise.allSettled(ids.map((id) => restoreNote(id)));
          await afterChange();
        },
      );
    } catch (error: any) {
      message.error(error?.message || "Could not move the items to Trash");
    }
  };

  const title = isHealth
    ? "Security health"
    : isTrash
      ? "Trash"
      : nav.view === "favorites"
        ? "Favorites"
        : nav.view === "shared"
          ? "Shared with me"
          : activeCollection
            ? activeCollection.name
            : nav.category
              ? categoryPlural(nav.category)
              : nav.tag
                ? `#${nav.tag}`
                : "All items";

  const [emptyTitle, emptyText] = nav.search
    ? ["No matches", `Nothing here matches “${nav.search}”.`]
    : isHealth
      ? ["All clear", "No weak, reused or old passwords."]
      : isTrash
        ? ["Trash is empty", "Deleted items stay here for 30 days."]
        : nav.view === "favorites"
          ? ["No favorites yet", "Star an item to pin it here."]
          : nav.view === "shared"
            ? [
                "Nothing shared with you",
                "Items people share with you show up here.",
              ]
            : companyId && collections.length === 0
              ? [
                  "No items yet",
                  "Items show up here after a collection is shared with you.",
                ]
              : ["Nothing here yet", "Use New item to add your first one."];

  const canSelect =
    !isHealth && !isTrash && list.some((note) => isNoteOwner(note));
  const editableCollections = collections.filter(
    (collection) =>
      collection.permission === "owner" || collection.permission === "edit",
  );

  const canShareCollection =
    !isTrash && !isHealth && !!activeCollection?.isOwner;
  const shareCollectionButton = canShareCollection ? (
    <Tooltip title="Share collection">
      <Button
        size="small"
        type="primary"
        aria-label="Share collection"
        icon={<ShareAltOutlined />}
        onClick={() => {
          if (companyId && activeCollection) {
            nav.update({
              tab: "collections",
              share: String(activeCollection.id),
              item: null,
              new: null,
            });
          } else {
            setCollectionShareOpen(true);
          }
        }}
      />
    </Tooltip>
  ) : null;

  // A personal collection someone shared with you: leave it, with all its items.
  const canLeaveCollection =
    !companyId &&
    !isTrash &&
    !isHealth &&
    !!activeCollection &&
    !activeCollection.isOwner;
  const leaveCollection = () => {
    if (!activeCollection) return;
    const collection = activeCollection;
    Modal.confirm({
      title: `Leave "${collection.name}"?`,
      content:
        "You stop seeing this collection and every item in it. The owner keeps it and can share it with you again.",
      okText: "Leave collection",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherPost(`/api/collections/${collection.id}/leave`, {});
          message.success(`You left "${collection.name}"`);
          nav.go();
          refreshVault();
        } catch (error: any) {
          message.error(error?.message || "Could not leave the collection");
        }
      },
    });
  };
  const leaveCollectionButton = canLeaveCollection ? (
    <Tooltip title="Leave collection">
      <Button
        size="small"
        aria-label="Leave collection"
        icon={<LogoutOutlined />}
        onClick={leaveCollection}
      />
    </Tooltip>
  ) : null;

  const selectionToolbar = isTrash ? (
    list.length > 0 && (
      <Tooltip title="Empty Trash">
        <Button
          size="small"
          danger
          aria-label="Empty Trash"
          icon={<DeleteOutlined />}
          onClick={handleEmptyTrash}
        />
      </Tooltip>
    )
  ) : canSelect ? (
    <Tooltip title={selecting ? "Done selecting" : "Select items"}>
      <Button
        size="small"
        type={selecting ? "primary" : "default"}
        aria-label={selecting ? "Done selecting" : "Select items"}
        aria-pressed={selecting}
        icon={selecting ? <CheckOutlined /> : <CheckSquareOutlined />}
        onClick={() => {
          setSelecting((value) => !value);
          setCheckedIds([]);
        }}
      />
    </Tooltip>
  ) : null;

  const toolbar =
    shareCollectionButton || leaveCollectionButton || selectionToolbar ? (
      <>
        {shareCollectionButton}
        {leaveCollectionButton}
        {selectionToolbar}
      </>
    ) : null;

  const banner = isHealth ? (
    <HealthSummary
      logins={
        summary.filter((note) => ["password", "login"].includes(note.category))
          .length
      }
      counts={healthCounts}
      flagged={summary.filter((note) => healthIssues(note).length > 0).length}
      active={nav.health}
      onPick={(kind) => nav.update({ health: kind || "1", item: null })}
    />
  ) : isTrash && list.length > 0 ? (
    <div className="list-note">
      <InboxOutlined /> Items in Trash are deleted for good after 30 days.
    </div>
  ) : null;

  const footer =
    selecting && checkedIds.length > 0 ? (
      <div className="bulk-bar">
        <span className="bulk-count">{checkedIds.length} selected</span>
        <Select
          size="small"
          placeholder="Move to…"
          aria-label="Move to collection"
          popupMatchSelectWidth={false}
          value={bulkCollection}
          onChange={setBulkCollection}
          options={[
            ...(companyId ? [] : [{ value: "none", label: "No collection" }]),
            ...editableCollections.map((collection) => ({
              value: String(collection.id),
              label: collection.name,
            })),
          ]}
        />
        <Button
          size="small"
          onClick={handleBulkMove}
          disabled={!bulkCollection}
        >
          Move
        </Button>
        <Button size="small" danger onClick={handleBulkTrash}>
          Trash
        </Button>
      </div>
    ) : null;

  const renderDetail = () => {
    if (nav.newCategory) {
      return (
        <NoteEditor
          key={`new-${nav.newCategory}`}
          initialCategory={nav.newCategory}
          collections={collections}
          requireCollection={!!companyId}
          defaultCollectionId={
            activeCollection &&
            (activeCollection.permission === "owner" ||
              activeCollection.permission === "edit")
              ? activeCollection.id
              : undefined
          }
          onCancel={() => nav.update({ new: null })}
          onSaved={(note) => {
            nav.update({ new: null, item: String(note.id) });
            afterChange();
            message.success(`“${note.title}” created`);
          }}
        />
      );
    }

    if (!selected) {
      return (
        <div className="detail-empty">
          <strong>Nothing selected</strong>
          <span>Pick an item from the list to see its details.</span>
        </div>
      );
    }

    if (editing?.id === selected.id) {
      return (
        <NoteEditor
          key={`edit-${selected.id}-${editing.freshPassword}`}
          note={selected}
          freshPassword={editing.freshPassword}
          collections={collections}
          requireCollection={!!companyId}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            const fixed = editing.freshPassword;
            setEditing(null);
            afterChange();
            message.success(fixed ? "Password changed" : "Changes saved");
          }}
        />
      );
    }

    return (
      <ItemDetail
        note={selected}
        trash={isTrash}
        onBack={() => nav.update({ item: null })}
        onEdit={() => setEditing({ id: selected.id, freshPassword: false })}
        onChangePassword={() =>
          setEditing({ id: selected.id, freshPassword: true })
        }
        onFavorite={() => handleFavorite(selected)}
        onShare={() => setSharingNote(selected)}
        onDelete={() => handleDelete(selected)}
        onRestore={() => handleRestore(selected)}
        onRemoveFromCollection={
          activeCollection &&
          (activeCollection.isOwner || isNoteOwner(selected))
            ? () => handleRemoveFromCollection(selected)
            : undefined
        }
      />
    );
  };

  return (
    <div className={detailOpen ? "vault-view has-detail" : "vault-view"}>
      <ItemList
        title={title}
        notes={list}
        loading={loading && !isHealth}
        selectedId={selected?.id ?? null}
        onSelect={(id) => nav.selectItem(id)}
        filter={
          <ListFilter
            value={nav.search}
            placeholder="Filter by name, field or tag…"
            onChange={(search) => nav.update({ search, item: null })}
          />
        }
        toolbar={toolbar}
        banner={banner}
        footer={footer}
        emptyTitle={emptyTitle}
        emptyText={emptyText}
        emptyAction={
          // A new, empty personal vault: bring passwords over from another manager.
          !companyId &&
          nav.view === "all" &&
          !nav.category &&
          !nav.collection &&
          !nav.tag &&
          !nav.search ? (
            <Button icon={<KeyOutlined />} onClick={() => setImportOpen(true)}>
              Import from Google or Chrome
            </Button>
          ) : undefined
        }
        selecting={selecting}
        checkedIds={checkedIds}
        onCheck={(id, checked) =>
          setCheckedIds((current) =>
            checked
              ? [...current, id]
              : current.filter((noteId) => noteId !== id),
          )
        }
        activeTag={nav.tag && title !== `#${nav.tag}` ? nav.tag : undefined}
        onClearTag={() => nav.update({ tag: null })}
      />

      <section className="detail-pane" aria-label="Item details">
        {renderDetail()}
      </section>

      <ShareModal
        visible={!!sharingNote}
        note={sharingNote}
        onClose={() => setSharingNote(null)}
      />
      {collectionShareOpen && activeCollection && (
        <CollectionDialogs
          mode="share"
          collection={activeCollection}
          onClose={() => setCollectionShareOpen(false)}
          onChanged={afterChange}
        />
      )}
    </div>
  );
};

export default NotesPage;
