import {
  AppstoreOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FilterOutlined,
  PlusOutlined,
  ShareAltOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Grid,
  Modal,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import NotesSearch from "../../components/header/NotesSearch";
import CategoryDot from "../../components/noteCategory/CategoryDot";
import FieldActions from "../../components/noteField/FieldActions";
import PasswordHealthMark from "../../components/passwordHealth/PasswordHealthMark";
import PlatformIcon from "../../components/platformIcon/PlatformIcon";
import UpdatedAt from "../../components/updatedAt/UpdatedAt";
import axios from "../../configs/axios";
import useFieldClipboard from "../../hooks/useFieldClipboard";
import { useNoteStore } from "../../store/noteStore";
import NoteCard from "./NoteCard";
import NoteModal from "./NoteModal";
import ShareModal from "./ShareModal";
import "./NotesPage.scss";
import NoteViewModal from "./NoteViewModal";
import CollectionDialogs from "./CollectionDialogs";
import { subscribeOpenCollections } from "../../utils/collectionsDrawer";
import { CollectionItem } from "../../store/noteStore";
import { cardBrandFromFields, formatCardField } from "../../utils/cardField";
import { isURL } from "../../utils/isUrl";
import { categoryKey } from "../../utils/noteCategory";
import { isSecretField } from "../../utils/secretField";
import { buildNoteActions, isNoteOwner } from "./NoteActions";

const { Text } = Typography;

const categories = [
  { value: "all", label: "All categories" },
  { value: "note", label: "Notes" },
  { value: "password", label: "Login" },
  { value: "command", label: "Commands" },
  { value: "ssh", label: "SSH" },
  { value: "db", label: "Database" },
  { value: "address", label: "Address" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

// Same column widths for cards everywhere: 1 / 2 / 3 / 4 / 6 per row.
const gridCol = { xs: 24, sm: 12, lg: 8, xl: 6, xxl: 4 };

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

const NotesPage = ({
  companyId,
  collectionKey,
}: {
  companyId?: number;
  collectionKey?: string;
}) => {
  const {
    notes,
    loading,
    fetchNotes,
    deleteNote,
    restoreNote,
    toggleFavorite,
    exportNotes,
    importNotes,
    fetchCollections,
    deleteCollection,
    addNotesToCollection,
    removeNoteFromCollection,
    emptyTrash,
    bulkUpdateNotes,
  } = useNoteStore();

  const screens = Grid.useBreakpoint();
  const inlineFilters = !!screens.xl;
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") || "all";
  const selectedCategory = categoryParam === "login" ? "password" : categoryParam;
  const selectedCollection = searchParams.get("collection") || "all";
  const selectedTag = searchParams.get("tag") || "all";
  const searchQuery = searchParams.get("search") || "";
  const importInputRef = useRef<HTMLInputElement>(null);
  const viewFilter =
    searchParams.get("trash") === "true"
      ? "trash"
      : searchParams.get("shared") === "true"
        ? "shared"
        : searchParams.get("favorites") === "true"
          ? "favorites"
          : "all";

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingNote, setSharingNote] = useState<any>(null);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [collectionMode, setCollectionMode] = useState<
    "create" | "rename" | "add" | "share" | null
  >(null);
  const showCollections =
    !companyId && searchParams.get("tab") === "collections";
  const [dialogCollection, setDialogCollection] =
    useState<CollectionItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCollection, setBulkCollection] = useState<string>();
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    const saved = localStorage.getItem("notesViewMode");
    return (saved as "card" | "table") || "card";
  });
  const clipboard = useFieldClipboard();

  const handleShare = (note: any) => {
    setSharingNote(note);
    setShareModalVisible(true);
  };

  const handleShareModalClose = () => {
    setShareModalVisible(false);
    setSharingNote(null);
  };

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([key, value]) => {
            if (!value || value === "all") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const fetchWithCurrentFilters = useCallback(() => {
    return fetchNotes({
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      tag: selectedTag !== "all" ? selectedTag : undefined,
      search: searchQuery || undefined,
      sharedOnly: viewFilter === "shared",
      trash: viewFilter === "trash",
      isFavorite: viewFilter === "favorites",
      collectionId:
        selectedCollection !== "all" ? Number(selectedCollection) : undefined,
      companyId,
    });
  }, [
    fetchNotes,
    selectedCategory,
    selectedTag,
    searchQuery,
    viewFilter,
    selectedCollection,
    companyId,
  ]);

  const handleViewModeChange = (mode: "card" | "table") => {
    setViewMode(mode);
    localStorage.setItem("notesViewMode", mode);
  };

  useEffect(() => {
    fetchWithCurrentFilters();
  }, [fetchWithCurrentFilters]);

  useEffect(() => {
    loadCollections();
    if (companyId) return;
    return subscribeOpenCollections(() =>
      updateSearchParams({ tab: "collections" })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, collectionKey]);

  useEffect(() => {
    if (selectedTag !== "all") return;
    const allTags = notes.flatMap((note) => note.tags || []);
    const uniqueTags = Array.from(new Set(allTags)).sort();
    setAvailableTags(uniqueTags);
  }, [notes, selectedTag]);

  const loadCollections = async () => {
    try {
      if (companyId) {
        const response = await axios.get(`/api/companies/${companyId}/collections`);
        setCollections(
          (response.data || []).map((collection: CollectionItem) => ({
            ...collection,
            isOwner: collection.permission === "owner",
          }))
        );
        return;
      }
      const list = await fetchCollections();
      setCollections(list);
    } catch (error) {
      console.error("Failed to load collections");
    }
  };

  const activeCollection =
    collections.find((item) => String(item.id) === selectedCollection) || null;

  const openCollectionDialog = (
    mode: "create" | "rename" | "add" | "share",
    collection?: CollectionItem,
  ) => {
    setDialogCollection(collection || null);
    setCollectionMode(mode);
  };

  // Deleting a collection drops its sharing for good, so this one still asks first.
  const handleDeleteCollection = (collection: CollectionItem) => {
    Modal.confirm({
      title: `Delete "${collection.name}"?`,
      content:
        "Notes in this collection stay in your list, without a collection.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteCollection(collection.id);
        if (String(collection.id) === selectedCollection) {
          updateSearchParams({ collection: null });
        }
        await loadCollections();
        message.success("Collection deleted");
      },
    });
  };

  const handleRemoveFromCollection = async (noteId: number) => {
    if (!activeCollection) return;
    const collection = activeCollection;
    try {
      await removeNoteFromCollection(collection.id, noteId);
      fetchWithCurrentFilters();
      loadCollections();
      undoToast(`Removed from ${collection.name}`, async () => {
        await addNotesToCollection(collection.id, [noteId]);
        await fetchWithCurrentFilters();
        loadCollections();
      });
    } catch (error: any) {
      message.error(error?.message || "Could not remove note");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      undoToast("Note moved to trash", async () => {
        await restoreNote(id);
        await fetchWithCurrentFilters();
      });
    } catch {
      message.error("Failed to delete note");
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await restoreNote(id);
      message.success("Note restored");
    } catch {
      message.error("Failed to restore note");
    }
  };

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((noteId) => noteId !== id),
    );
  };

  const finishBulk = async (result: { updated: number; skipped: number }) => {
    setSelectedIds([]);
    setBulkCollection(undefined);
    await fetchWithCurrentFilters();
    if (result.skipped) {
      message.warning(
        `Updated ${result.updated}. Skipped ${result.skipped} you do not own.`,
      );
    } else {
      message.success(`Updated ${result.updated} notes`);
    }
  };

  const handleBulkMove = async () => {
    if (!bulkCollection || !selectedIds.length) return;
    try {
      const result = await bulkUpdateNotes(
        selectedIds,
        "move",
        bulkCollection === "none" ? null : Number(bulkCollection),
      );
      await loadCollections();
      await finishBulk(result);
    } catch (error: any) {
      message.error(error?.message || "Could not move notes");
    }
  };

  const handleBulkTrash = async () => {
    const ids = [...selectedIds];
    try {
      const result = await bulkUpdateNotes(ids, "trash");
      setSelectedIds([]);
      await fetchWithCurrentFilters();
      const moved = result.updated === 1 ? "1 note" : `${result.updated} notes`;
      undoToast(
        `Moved ${moved} to trash${result.skipped ? `. Skipped ${result.skipped} you do not own` : ""}`,
        async () => {
          await Promise.allSettled(ids.map((id) => restoreNote(id)));
          await fetchWithCurrentFilters();
        },
      );
    } catch (error: any) {
      message.error(error?.message || "Could not move notes to trash");
    }
  };

  // Emptying the trash is permanent, so it asks first.
  const handleEmptyTrash = () => {
    Modal.confirm({
      title: "Empty trash?",
      content: "This permanently deletes every note in the trash.",
      okText: "Delete permanently",
      okButtonProps: { danger: true },
      onOk: async () => {
        const deleted = await emptyTrash();
        message.success(
          deleted === 1 ? "Deleted 1 note" : `Deleted ${deleted} notes`,
        );
        fetchWithCurrentFilters();
      },
    });
  };

  const handleEdit = (note: any) => {
    setEditingNote(note);
    setModalVisible(true);
  };

  const handleView = (note: any) => {
    setViewingNote(note);
    setViewModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingNote(null);
  };

  const handleViewModalClose = () => {
    setViewModalVisible(false);
    setViewingNote(null);
  };

  const handleViewFilterChange = (value: string) => {
    updateSearchParams({
      shared: value === "shared" ? "true" : null,
      trash: value === "trash" ? "true" : null,
      favorites: value === "favorites" ? "true" : null,
    });
  };

  const handleExport = async () => {
    try {
      const backup = await exportNotes();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      if (backup.skipped) {
        message.warning(
          `Exported ${backup.notes.length} notes. Skipped ${backup.skipped} that could not be decrypted.`,
        );
      } else {
        message.success(`Exported ${backup.notes.length} notes`);
      }
    } catch (error: any) {
      message.error(error?.message || "Failed to export notes");
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const notes = Array.isArray(parsed) ? parsed : parsed?.notes;
      if (!Array.isArray(notes) || notes.length === 0) {
        message.error("That file has no notes to import");
        return;
      }
      const result = await importNotes(notes);
      fetchWithCurrentFilters();
      if (result.failed?.length) {
        message.warning(
          `Imported ${result.imported}. ${result.failed.length} could not be imported.`,
        );
      } else {
        message.success(`Imported ${result.imported} notes`);
      }
    } catch (error: any) {
      message.error(error?.message || "Failed to import notes");
    }
  };

  const filteredNotes =
    viewFilter === "favorites"
      ? notes.filter((note) => note.isFavorite)
      : notes;

  const actionHandlers = (note: any) => ({
    trash: viewFilter === "trash",
    onView: handleView,
    onFavorite: (item: any) => toggleFavorite(item.id),
    onShare: handleShare,
    onEdit: handleEdit,
    onDelete: (item: any) => handleDelete(item.id),
    onRestore: (item: any) => handleRestore(item.id),
    onRemoveFromCollection:
      activeCollection && (activeCollection.isOwner || isNoteOwner(note))
        ? (item: any) => handleRemoveFromCollection(item.id)
        : undefined,
  });

  const getCustomFields = (content: any) => {
    if (typeof content === "object" && content !== null) {
      return content.customFields || [];
    }
    return [];
  };

  const getTableColumns = () => {
    return [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        width: 220,
        fixed: "left" as const,
        ellipsis: true,
        sorter: (a: any, b: any) => a.title.localeCompare(b.title),
        render: (text: string, record: any) => (
          <Space size={6} wrap>
            <PlatformIcon note={record} size={20} />
            <button
              type="button"
              className="note-title-button table-title"
              onClick={(event) => {
                event.stopPropagation();
                handleView(record);
              }}
            >
              {text}
            </button>
            {record.isShared && !record.collection?.companyId && (
              <Tooltip title={`Shared by ${record.sharedByName || "someone"}`}>
                <Tag className="note-shared" style={{ margin: 0 }}>
                  {record.sharedByName || "Shared"}
                </Tag>
              </Tooltip>
            )}
            <PasswordHealthMark health={record.passwordHealth} />
          </Space>
        ),
      },
      {
        title: "Category",
        dataIndex: "category",
        key: "category",
        width: 130,
        filters: categories.slice(1).map((cat) => ({
          text: cat.label,
          value: cat.value,
        })),
        onFilter: (value: any, record: any) => categoryKey(record.category) === value,
        render: (category: string) => <CategoryDot category={category} />,
      },
      {
        title: "Collection",
        key: "collection",
        width: 140,
        ellipsis: true,
        render: (_: string, record: any) => {
          const collections = record.collections?.length
            ? record.collections
            : record.collection?.name
              ? [record.collection]
              : [];
          return collections.length ? (
            <Space size={4} wrap>
              {collections.map((collection: { id: number; name: string }) => (
                <Tag key={collection.id} className="note-collection">
                  {collection.name}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          );
        },
      },
      {
        title: "Tags",
        dataIndex: "tags",
        key: "tags",
        width: 150,
        render: (tags: string[]) =>
          tags && tags.length > 0 ? (
            <Space size={4} wrap>
              {tags.slice(0, 3).map((tag: string, index: number) => (
                <Tag key={index} className="note-tag">
                  {tag}
                </Tag>
              ))}
              {tags.length > 3 && (
                <Tag className="note-tag">+{tags.length - 3}</Tag>
              )}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: "Content",
        dataIndex: "content",
        key: "content",
        width: 600,
        render: (content: any, record: any) => {
          const customFields = getCustomFields(content);
          const cardBrand = cardBrandFromFields(customFields);
          if (content.mainContent) {
            return (
              <div className="table-field table-field-single">
                <div className="table-field-line">
                  <Text className="table-field-value" ellipsis>
                    {content.mainContent}
                  </Text>
                  <FieldActions
                    fieldKey={`table-main-${record.id}`}
                    label="Content"
                    value={content.mainContent}
                    clipboard={clipboard}
                  />
                </div>
              </div>
            );
          }
          if (customFields.length === 0) {
            return <Text type="secondary">No content</Text>;
          }
          return (
            <div className="table-fields">
              {customFields.map((field: any, idx: number) => {
                if (!field.value) return null;
                const fieldKey = `table-${record.id}-${idx}`;
                const secret = isSecretField(field.label);
                const url = field.label.toLowerCase() === "url" && isURL(String(field.value));
                const shownValue = formatCardField(
                  field.label,
                  String(field.value ?? ""),
                  "",
                  cardBrand
                );
                const hidden = secret && !clipboard.isVisible(fieldKey);
                return (
                  <div key={idx} className="table-field">
                    <Text className="table-field-label">{field.label}</Text>
                    <div className="table-field-line">
                      <Text
                        ellipsis
                        className={`table-field-value${url ? " is-url" : ""}${
                          hidden ? " is-secret" : ""
                        }`}
                        title={hidden ? undefined : shownValue}
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
                    </div>
                  </div>
                );
              })}
            </div>
          );
        },
      },
      {
        title: "Updated",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 150,
        sorter: (a: any, b: any) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        render: (value: string) => <UpdatedAt value={value} className="note-date" />,
      },
      {
        title: "Actions",
        key: "actions",
        width: 190,
        fixed: "right" as const,
        render: (_: any, record: any) => (
          <Space size={2}>
            {buildNoteActions(record, { ...actionHandlers(record), size: "small" })}
          </Space>
        ),
      },
    ];
  };

  const activeFilterCount = [
    selectedCategory,
    selectedCollection,
    selectedTag,
    viewFilter,
  ].filter((value) => value !== "all").length;

  const filterControls: ReactNode[] = [
    <Select
      key="category"
      aria-label="Category"
      value={selectedCategory}
      onChange={(category) => updateSearchParams({ category })}
      popupClassName="notes-select-dropdown"
      options={categories}
    />,
    <Select
      key="collection"
      aria-label="Collection"
      value={selectedCollection}
      onChange={(collection) => updateSearchParams({ collection })}
      popupClassName="notes-select-dropdown"
      options={[
        { value: "all", label: "All collections" },
        ...collections.map((collection) => ({
          value: String(collection.id),
          label: `${collection.name}${!companyId && !collection.isOwner ? " (shared)" : ""}`,
        })),
      ]}
    />,
    <Select
      key="tag"
      aria-label="Tag"
      value={selectedTag}
      onChange={(tag) => updateSearchParams({ tag })}
      popupClassName="notes-select-dropdown"
      options={[
        { value: "all", label: "All tags" },
        ...availableTags.map((tag) => ({ value: tag, label: tag })),
      ]}
    />,
    <Select
      key="view"
      aria-label="Show"
      value={viewFilter}
      onChange={handleViewFilterChange}
      popupClassName="notes-select-dropdown"
      options={
        companyId
          ? [
              { value: "all", label: "All notes" },
              { value: "favorites", label: "Favorites" },
            ]
          : [
              { value: "all", label: "Mine & shared" },
              { value: "shared", label: "Shared with me" },
              { value: "favorites", label: "Favorites" },
              { value: "trash", label: "Trash" },
            ]
      }
    />,
  ];

  const clearFilters = () =>
    updateSearchParams({
      category: null,
      collection: null,
      tag: null,
      shared: null,
      trash: null,
      favorites: null,
    });

  const newNoteDisabled =
    !!companyId &&
    !collections.some(
      (collection) =>
        collection.permission === "owner" || collection.permission === "edit"
    );

  const renderNotes = () => {
    if (loading && notes.length === 0) {
      return viewMode === "card" ? (
        <Row gutter={[16, 16]} aria-busy="true" aria-label="Loading notes">
          {Array.from({ length: 8 }, (_, index) => (
            <Col {...gridCol} key={index}>
              <Card className="note-card note-card-skeleton">
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Table
          className="notes-table"
          loading
          dataSource={[]}
          columns={getTableColumns()}
          scroll={{ x: 1350 }}
          rowKey="id"
        />
      );
    }

    if (filteredNotes.length === 0) {
      return (
        <Empty
          description={
            companyId && collections.length === 0
              ? "No notes yet. Notes show up here after a collection is shared with you."
              : "No notes found. Try adjusting your filters or create a new note!"
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return viewMode === "card" ? (
      <Row gutter={[16, 16]}>
        {filteredNotes.map((note) => (
          <Col {...gridCol} key={note.id}>
            <NoteCard
              note={note}
              selected={selectedIds.includes(note.id)}
              onToggleSelect={toggleSelected}
              {...actionHandlers(note)}
            />
          </Col>
        ))}
      </Row>
    ) : (
      <Table
        className="notes-table"
        dataSource={filteredNotes}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        columns={getTableColumns()}
        scroll={{ x: 1350 }}
        rowSelection={
          viewFilter === "trash"
            ? undefined
            : {
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys as number[]),
                getCheckboxProps: (record: any) => ({
                  disabled: !isNoteOwner(record),
                }),
              }
        }
        onRow={(record) => ({
          onClick: () => handleView(record),
          style: { cursor: "pointer" },
        })}
        size="middle"
      />
    );
  };

  return (
    <div className={companyId ? "notes-page company-notes" : "notes-page"}>
      {showCollections ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => openCollectionDialog("create")}>
              New collection
            </Button>
          </div>
          {collections.length === 0 ? (
            <Empty description="No collections yet." />
          ) : (
            <Row gutter={[16, 16]}>
              {collections.map((collection) => {
                const canEdit =
                  collection.permission === "owner" ||
                  collection.permission === "edit";
                const actions = [
                  <Tooltip key="notes" title="Notes">
                    <Button
                      type="text"
                      icon={<FileTextOutlined />}
                      aria-label="Notes"
                      onClick={() =>
                        updateSearchParams({
                          collection: String(collection.id),
                          tab: null,
                        })
                      }
                    />
                  </Tooltip>,
                ];
                if (canEdit) {
                  actions.push(
                    <Tooltip key="add" title="Add notes">
                      <Button
                        type="text"
                        icon={<FileAddOutlined />}
                        aria-label="Add notes"
                        onClick={() => openCollectionDialog("add", collection)}
                      />
                    </Tooltip>
                  );
                }
                if (collection.isOwner) {
                  actions.push(
                    <Tooltip key="share" title="Share">
                      <Button
                        type="text"
                        icon={<ShareAltOutlined />}
                        aria-label="Share"
                        onClick={() => openCollectionDialog("share", collection)}
                      />
                    </Tooltip>,
                    <Tooltip key="rename" title="Rename">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        aria-label="Rename"
                        onClick={() => openCollectionDialog("rename", collection)}
                      />
                    </Tooltip>,
                    <Tooltip key="delete" title="Delete">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="Delete"
                        onClick={() => handleDeleteCollection(collection)}
                      />
                    </Tooltip>
                  );
                }
                return (
                  <Col {...gridCol} key={collection.id}>
                    <Card className="note-card" actions={actions}>
                      <div className="note-title-row">
                        <Text strong ellipsis className="note-title">
                          {collection.name}
                        </Text>
                      </div>
                      <Text type="secondary">
                        {collection.noteCount}{" "}
                        {collection.noteCount === 1 ? "note" : "notes"}
                        {!collection.isOwner ? " · Shared with you" : ""}
                      </Text>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Space>
      ) : (
      <>
      <div className="notes-toolbar">
        <div className="notes-filters">
          <NotesSearch />
          {inlineFilters ? (
            filterControls
          ) : (
            <Badge count={activeFilterCount} size="small">
              <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)}>
                Filters
              </Button>
            </Badge>
          )}
          {inlineFilters && activeFilterCount > 0 && (
            <Button type="link" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
        <div className="notes-toolbar-start">
          <Segmented
            className="switcher"
            value={viewMode}
            onChange={(value) => handleViewModeChange(value as "card" | "table")}
            options={[
              {
                label: screens.sm ? "Cards" : undefined,
                value: "card",
                icon: <AppstoreOutlined />,
                title: "Cards",
              },
              {
                label: screens.sm ? "Table" : undefined,
                value: "table",
                icon: <UnorderedListOutlined />,
                title: "Table",
              },
            ]}
          />
          <Text className="notes-count" type="secondary">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </Text>
        </div>
        <Space className="notes-toolbar-actions">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) handleImportFile(file);
            }}
          />
          {!companyId && (
            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              overlayClassName="backup-dropdown"
              menu={{
                items: [
                  {
                    key: "export",
                    label: (
                      <span className="backup-option">
                        <span className="backup-icon export">
                          <DownloadOutlined />
                        </span>
                        <span className="backup-copy">
                          <strong>Export notes</strong>
                          <small>Download your vault as a .json backup</small>
                        </span>
                      </span>
                    ),
                    onClick: handleExport,
                  },
                  {
                    key: "import",
                    label: (
                      <span className="backup-option">
                        <span className="backup-icon import">
                          <UploadOutlined />
                        </span>
                        <span className="backup-copy">
                          <strong>Import notes</strong>
                          <small>Add notes from a Keevo .json file</small>
                        </span>
                      </span>
                    ),
                    onClick: () => importInputRef.current?.click(),
                  },
                ],
              }}
            >
              <Button icon={<CloudSyncOutlined />} aria-label="Backup: export or import notes">
                {screens.md && (
                  <>
                    Backup <DownOutlined className="backup-caret" />
                  </>
                )}
              </Button>
            </Dropdown>
          )}
          <Button
            className="new_note_button"
            type="primary"
            icon={<PlusOutlined />}
            disabled={newNoteDisabled}
            onClick={() => setModalVisible(true)}
          >
            New Note
          </Button>
        </Space>
      </div>

      <Drawer
        title="Filters"
        placement={screens.md ? "right" : "bottom"}
        height="auto"
        width={320}
        open={!inlineFilters && filtersOpen}
        onClose={() => setFiltersOpen(false)}
        className="notes-filters-drawer"
        extra={
          activeFilterCount > 0 && (
            <Button type="link" onClick={clearFilters}>
              Clear
            </Button>
          )
        }
      >
        <div className="notes-filters-stack">{filterControls}</div>
      </Drawer>

      {(viewFilter === "trash" && filteredNotes.length > 0) ||
      (viewFilter !== "trash" && selectedIds.length > 0) ? (
        <div className="notes-bulk-bar">
          <Space wrap>
            {viewFilter === "trash" && filteredNotes.length > 0 && (
              <Button danger onClick={handleEmptyTrash}>
                Empty trash
              </Button>
            )}
            {viewFilter !== "trash" && selectedIds.length > 0 && (
              <>
                <Text>{selectedIds.length} selected</Text>
                <Select
                  placeholder="Collection"
                  aria-label="Move to collection"
                  style={{ width: 180 }}
                  value={bulkCollection}
                  onChange={setBulkCollection}
                  options={[
                    ...(companyId ? [] : [{ value: "none", label: "No collection" }]),
                    ...collections
                      .filter(
                        (collection) =>
                          collection.permission === "owner" ||
                          collection.permission === "edit",
                      )
                      .map((collection) => ({
                        value: String(collection.id),
                        label: collection.name,
                      })),
                  ]}
                />
                <Button onClick={handleBulkMove} disabled={!bulkCollection}>
                  Move
                </Button>
                <Button danger onClick={handleBulkTrash}>
                  Move to trash
                </Button>
                <Button type="link" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
              </>
            )}
          </Space>
        </div>
      ) : null}

      <Spin spinning={loading && notes.length > 0}>{renderNotes()}</Spin>
      </>
      )}

      <NoteModal
        visible={modalVisible}
        note={editingNote}
        collections={companyId ? collections : undefined}
        requireCollection={!!companyId}
        defaultCollectionId={
          !editingNote &&
          activeCollection &&
          (activeCollection.permission === "owner" ||
            activeCollection.permission === "edit")
            ? activeCollection.id
            : undefined
        }
        onClose={handleModalClose}
        onSaved={() => {
          fetchWithCurrentFilters();
          loadCollections();
        }}
      />

      <CollectionDialogs
        mode={collectionMode}
        collection={dialogCollection}
        onClose={() => {
          setCollectionMode(null);
          setDialogCollection(null);
        }}
        onChanged={() => {
          loadCollections();
          fetchWithCurrentFilters();
        }}
      />

      <ShareModal
        visible={shareModalVisible}
        note={sharingNote}
        onClose={handleShareModalClose}
      />

      <NoteViewModal
        visible={viewModalVisible}
        note={viewingNote}
        onClose={handleViewModalClose}
        onShare={
          viewingNote && isNoteOwner(viewingNote)
            ? () => {
                handleViewModalClose();
                handleShare(viewingNote);
              }
            : undefined
        }
      />
    </div>
  );
};

export default NotesPage;
