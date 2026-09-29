import {
  AppstoreOutlined,
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Dropdown,
  Empty,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNoteStore } from "../../store/noteStore";
import NoteModal from "./NoteModal";
import ShareModal from "./ShareModal";
import "./NotesPage.scss";
import NoteViewModal from "./NoteViewModal";
import CollectionDialogs from "./CollectionDialogs";
import CollectionsDrawer from "./CollectionsDrawer";
import dayjsExtra from "../../utils/dayjs";
import { subscribeOpenCollections } from "../../utils/collectionsDrawer";
import { CollectionItem } from "../../store/noteStore";

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

const categories = [
  { value: "all", label: "All Notes", color: "default" },
  { value: "note", label: "Notes", color: "cyan" },
  { value: "password", label: "Passwords", color: "magenta" },
  { value: "login", label: "Logins", color: "geekblue" },
  { value: "command", label: "Commands", color: "purple" },
  { value: "ssh", label: "SSH", color: "volcano" },
  { value: "db", label: "Database", color: "blue" },
  { value: "other", label: "Other", color: "gold" },
];

const NotesPage = () => {
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
    removeNoteFromCollection,
    emptyTrash,
    bulkUpdateNotes,
  } = useNoteStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") || "all";
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
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [dialogCollection, setDialogCollection] =
    useState<CollectionItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCollection, setBulkCollection] = useState<string>();
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    const saved = localStorage.getItem("notesViewMode");
    return (saved as "card" | "table") || "card";
  });
  const [copiedFields, setCopiedFields] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set(),
  );

  const isNoteOwner = (note: any) =>
    note?.isOwner === true || note?.permission === "owner";

  const canEditNote = (note: any) =>
    isNoteOwner(note) || note?.permission === "edit";

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
    fetchNotes({
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      tag: selectedTag !== "all" ? selectedTag : undefined,
      search: searchQuery || undefined,
      sharedOnly: viewFilter === "shared",
      trash: viewFilter === "trash",
      isFavorite: viewFilter === "favorites",
      collectionId:
        selectedCollection !== "all" ? Number(selectedCollection) : undefined,
    });
  }, [
    fetchNotes,
    selectedCategory,
    selectedTag,
    searchQuery,
    viewFilter,
    selectedCollection,
  ]);

  const handleViewModeChange = (mode: "card" | "table") => {
    setViewMode(mode);
    localStorage.setItem("notesViewMode", mode);
  };

  // Utility function to check if a value is a URL
  const isURL = (value: any): boolean => {
    if (!value) return false;
    const strValue = String(value);
    try {
      const url = new URL(strValue);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      // Try with http:// prefix if it looks like a URL
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

  // Open URL in new tab
  const openURL = (value: any) => {
    const strValue = String(value);
    let url = strValue;
    if (!strValue.startsWith("http://") && !strValue.startsWith("https://")) {
      url = `http://${strValue}`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    fetchWithCurrentFilters();
  }, [fetchWithCurrentFilters]);

  useEffect(() => {
    loadCollections();
    return subscribeOpenCollections(() => setCollectionsOpen(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (collectionsOpen) loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionsOpen]);

  useEffect(() => {
    if (selectedTag !== "all") return;
    const allTags = notes.flatMap((note) => note.tags || []);
    const uniqueTags = Array.from(new Set(allTags)).sort();
    setAvailableTags(uniqueTags);
  }, [notes, selectedTag]);

  const loadCollections = async () => {
    try {
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
    try {
      await removeNoteFromCollection(activeCollection.id, noteId);
      message.success("Removed from collection");
      fetchWithCurrentFilters();
      loadCollections();
    } catch (error: any) {
      message.error(error?.message || "Could not remove note");
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: "Move this note to trash?",
      content: "You can restore it later from the Trash filter.",
      okText: "Move to trash",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteNote(id);
          message.success("Note moved to trash");
        } catch {
          message.error("Failed to delete note");
        }
      },
    });
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

  const handleBulkTrash = () => {
    Modal.confirm({
      title: `Move ${selectedIds.length} notes to trash?`,
      okText: "Move to trash",
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await bulkUpdateNotes(selectedIds, "trash");
        await finishBulk(result);
      },
    });
  };

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

  const handleCategoryChange = (category: string) => {
    updateSearchParams({ category });
  };

  const handleCollectionChange = (collection: string) => {
    updateSearchParams({ collection });
  };

  const handleTagChange = (tag: string) => {
    updateSearchParams({ tag });
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

  const getCategoryColor = (category: string) => {
    return categories.find((c) => c.value === category)?.color || "default";
  };

  const filteredNotes =
    viewFilter === "favorites"
      ? notes.filter((note) => note.isFavorite)
      : notes;

  const copyToClipboard = (text: string, fieldKey: string, label?: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        // Add to copied fields
        setCopiedFields((prev) => new Set(prev).add(fieldKey));

        // Remove after 2 seconds
        setTimeout(() => {
          setCopiedFields((prev) => {
            const newSet = new Set(prev);
            newSet.delete(fieldKey);
            return newSet;
          });
        }, 2000);

        message.success(`${label || "Text"} copied!`, 1.5);
      },
      () => {
        message.error("Failed to copy to clipboard");
      },
    );
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  };

  const getCustomFields = (content: any) => {
    if (typeof content === "object" && content !== null) {
      return content.customFields || [];
    }
    return [];
  };

  // Generate table columns with custom fields under content
  const getTableColumns = () => {
    return [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        width: 200,
        fixed: "left" as const,
        ellipsis: true,
        sorter: (a: any, b: any) => a.title.localeCompare(b.title),
        render: (text: string, record: any) => (
          <Space size={4} wrap>
            <Text strong style={{ cursor: "pointer" }}>
              {text}
            </Text>
            {record.isShared && (
              <Tag color="purple" style={{ margin: 0 }}>
                Shared
              </Tag>
            )}
            <PasswordHealthMark health={record.passwordHealth} />
          </Space>
        ),
      },
      {
        title: "Category",
        dataIndex: "category",
        key: "category",
        width: 120,
        filters: categories.slice(1).map((cat) => ({
          text: cat.label,
          value: cat.value,
        })),
        onFilter: (value: any, record: any) => record.category === value,
        render: (category: string) => (
          <Tag color={getCategoryColor(category)}>{category.toUpperCase()}</Tag>
        ),
      },
      {
        title: "Collection",
        key: "collection",
        width: 140,
        ellipsis: true,
        render: (_: string, record: any) =>
          record.collection?.name ? (
            <Tag color="processing" style={{ margin: 0 }}>
              {record.collection.name}
            </Tag>
          ) : (
            <Text type="secondary">-</Text>
          ),
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
                <Tag key={index} style={{ margin: 0 }}>
                  {tag}
                </Tag>
              ))}
              {tags.length > 3 && (
                <Tag style={{ margin: 0 }}>+{tags.length - 3}</Tag>
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
          if (content.mainContent) {
            const fieldKey = `table-main-${record.id}`;
            const isCopied = copiedFields.has(fieldKey);

            return (
              <div
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "8px",
                  borderRadius: "8px",
                  background: "var(--surfaceMuted)",
                  border: "1px solid var(--borderSubtle)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  width: "fit-content",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(
                    content.mainContent,
                    fieldKey,
                    "Main Content",
                  );
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text>{content.mainContent}</Text>
                  {isCopied ? (
                    <CheckOutlined
                      style={{
                        color: "#52c41a",
                        fontSize: 12,
                        marginLeft: 8,
                      }}
                    />
                  ) : (
                    <CopyOutlined
                      style={{
                        color: "var(--iconMuted)",
                        fontSize: 11,
                        opacity: 0.5,
                        marginLeft: 8,
                        cursor: "pointer",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          }
          if (customFields.length === 0) {
            return <Text type="secondary">No content</Text>;
          }
          return (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {customFields.map((field: any, idx: number) => {
                const fieldKey = `table-${record.id}-${idx}`;
                const isCopied = copiedFields.has(fieldKey);
                const isPasswordField =
                  field.label?.toLowerCase().includes("password") ||
                  field.label?.toLowerCase().includes("pass");
                const isUrlField = field.label === "URL";
                const showPassword = visiblePasswords.has(fieldKey);
                const displayValue =
                  isPasswordField && !showPassword
                    ? "•".repeat(Math.min(String(field.value).length, 12))
                    : field.value;

                if (!field.value) return null;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      padding: "8px",
                      borderRadius: "8px",
                      background: "var(--surfaceMuted)",
                      border: "1px solid var(--borderSubtle)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      minWidth: "120px",
                      maxWidth: "180px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surfaceHover)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "var(--boxShadow)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--surfaceMuted)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(field.value, fieldKey, field.label);
                    }}
                  >
                    <Text
                      type="secondary"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {field.label}
                    </Text>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        ellipsis
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: isUrlField
                            ? "var(--colorInfo)"
                            : "var(--colorText)",
                          fontFamily:
                            isPasswordField && !showPassword
                              ? "monospace"
                              : undefined,
                          letterSpacing:
                            isPasswordField && !showPassword
                              ? "2px"
                              : undefined,
                        }}
                        title={field.value}
                      >
                        {displayValue}
                      </Text>

                      <div style={{ display: "flex", alignItems: "center" }}>
                        {isPasswordField && (
                          <Tooltip
                            title={showPassword ? "Hide value" : "Show value"}
                          >
                            {showPassword ? (
                              <EyeInvisibleOutlined
                                style={{
                                  color: "var(--iconMuted)",
                                  fontSize: 12,
                                  marginLeft: 8,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePasswordVisibility(fieldKey);
                                }}
                              />
                            ) : (
                              <EyeOutlined
                                style={{
                                  color: "var(--iconMuted)",
                                  fontSize: 12,
                                  marginLeft: 8,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePasswordVisibility(fieldKey);
                                }}
                              />
                            )}
                          </Tooltip>
                        )}
                        {isUrlField && (
                          <LinkOutlined
                            style={{
                              color: "var(--iconMuted)",
                              fontSize: 11,
                              marginLeft: 8,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openURL(field.value);
                            }}
                          />
                        )}
                        {isCopied ? (
                          <CheckOutlined
                            style={{
                              color: "#52c41a",
                              fontSize: 12,
                              marginLeft: 8,
                            }}
                          />
                        ) : (
                          <CopyOutlined
                            style={{
                              color: "var(--iconMuted)",
                              fontSize: 11,
                              opacity: 0.5,
                              marginLeft: 8,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 160,
        fixed: "right" as const,
        render: (_: any, record: any) => (
          <Space size="small">
            {viewFilter !== "trash" && (
              <Tooltip title="Toggle Favorite">
                <Button
                  type="text"
                  size="small"
                  icon={
                    record.isFavorite ? (
                      <StarFilled style={{ color: "#faad14" }} />
                    ) : (
                      <StarOutlined />
                    )
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(record.id);
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleView(record);
                }}
              />
            </Tooltip>
            {isNoteOwner(record) && (
              <Tooltip title="Share">
                <Button
                  type="text"
                  size="small"
                  icon={<ShareAltOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(record);
                  }}
                />
              </Tooltip>
            )}
            {canEditNote(record) && (
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(record);
                  }}
                />
              </Tooltip>
            )}
            {isNoteOwner(record) &&
              (viewFilter === "trash" ? (
                <Tooltip title="Restore">
                  <Button
                    type="text"
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(record.id);
                    }}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(record.id);
                    }}
                  />
                </Tooltip>
              ))}
          </Space>
        ),
      },
    ];
  };

  return (
    <div className="notes-page">
      <div className="notes-toolbar">
        <div className="notes-toolbar-start">
        <Segmented
          className="switcher"
          value={viewMode}
          onChange={(value) => handleViewModeChange(value as "card" | "table")}
          options={[
            {
              label: "Cards",
              value: "card",
              icon: <AppstoreOutlined />,
            },
            {
              label: "Table",
              value: "table",
              icon: <UnorderedListOutlined />,
            },
          ]}
        />
        <Text className="notes-count" type="secondary">
          {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
        </Text>
        </div>
        <div className="notes-filters">
          <Select
            value={selectedCategory}
            onChange={handleCategoryChange}
            popupClassName="notes-select-dropdown"
            options={categories}
          />
          <Select
            value={selectedCollection}
            onChange={handleCollectionChange}
            placeholder="Collection"
            popupClassName="notes-select-dropdown"
          >
            <Select.Option value="all">All collections</Select.Option>
            {collections.map((collection) => (
              <Select.Option key={collection.id} value={String(collection.id)}>
                {collection.name}
                {!collection.isOwner ? " (shared)" : ""}
              </Select.Option>
            ))}
          </Select>
          <Select
            value={selectedTag}
            onChange={handleTagChange}
            placeholder="Filter by tag"
            popupClassName="notes-select-dropdown"
          >
            <Select.Option value="all">All Tags</Select.Option>
            {availableTags.map((tag) => (
              <Select.Option key={tag} value={tag}>
                {tag}
              </Select.Option>
            ))}
          </Select>
          <Select
            value={viewFilter}
            onChange={handleViewFilterChange}
            popupClassName="notes-select-dropdown"
            options={[
              { value: "all", label: "Mine & shared" },
              { value: "shared", label: "Shared with me" },
              { value: "favorites", label: "Favorites" },
              { value: "trash", label: "Trash" },
            ]}
          />
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
          <Button
            size="large"
            icon={<FolderOutlined />}
            onClick={() => setCollectionsOpen(true)}
          >
            Collections
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: "export",
                  label: "Export backup",
                  icon: <DownloadOutlined />,
                  onClick: handleExport,
                },
                {
                  key: "import",
                  label: "Import backup",
                  onClick: () => importInputRef.current?.click(),
                },
              ],
            }}
          >
            <Button size="large">Backup</Button>
          </Dropdown>
          <Button
            className="new_note_button"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            size="large"
          >
            New Note
          </Button>
        </Space>
      </div>

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
                  style={{ width: 180 }}
                  value={bulkCollection}
                  onChange={setBulkCollection}
                  options={[
                    { value: "none", label: "No collection" },
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

      {loading && notes.length === 0 ? (
        <div className="notes-loading">
          <Spin size="large" />
        </div>
      ) : (
        <Spin spinning={loading} size="large">
          {filteredNotes.length === 0 ? (
            <Empty
              description="No notes found. Try adjusting your filters or create a new note!"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : viewMode === "card" ? (
            <Row gutter={[16, 16]}>
              {filteredNotes.map((note) => (
                <Col xs={24} sm={12} lg={6} xl={4} key={note.id}>
                  <Card
                    className="note-card"
                    hoverable
                    onClick={() => handleView(note)}
                    style={{ cursor: "pointer" }}
                    actions={[
                      ...(viewFilter !== "trash"
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
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(note.id);
                              }}
                            />,
                          ]
                        : []),
                      <Button
                        key="view"
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(note);
                        }}
                      />,
                      ...(isNoteOwner(note)
                        ? [
                            <Button
                              key="share"
                              type="text"
                              icon={<ShareAltOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare(note);
                              }}
                            />,
                          ]
                        : []),
                      ...(canEditNote(note)
                        ? [
                            <Button
                              key="edit"
                              type="text"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(note);
                              }}
                            />,
                          ]
                        : []),
                      ...(activeCollection &&
                      (activeCollection.isOwner || isNoteOwner(note))
                        ? [
                            <Tooltip
                              key="remove-collection"
                              title="Remove from collection"
                            >
                              <Button
                                type="text"
                                icon={<MinusCircleOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromCollection(note.id);
                                }}
                              />
                            </Tooltip>,
                          ]
                        : []),
                      ...(isNoteOwner(note)
                        ? [
                            viewFilter === "trash" ? (
                              <Button
                                key="restore"
                                type="text"
                                icon={<UndoOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(note.id);
                                }}
                              />
                            ) : (
                              <Button
                                key="delete"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(note.id);
                                }}
                              />
                            ),
                          ]
                        : []),
                    ]}
                  >
                    <div className="note-card-header">
                      <Tag color={getCategoryColor(note.category)}>
                        {note.category.toUpperCase()}
                      </Tag>
                      {note.isShared && <Tag color="purple">Shared</Tag>}
                      {note.collection?.name && (
                        <Tag color="processing">{note.collection.name}</Tag>
                      )}
                      {note.isFavorite && (
                        <StarFilled
                          style={{ color: "#faad14", fontSize: 16 }}
                        />
                      )}
                    </div>
                    <div className="note-title-row">
                      {isNoteOwner(note) && viewFilter !== "trash" && (
                        <Checkbox
                          className="note-select"
                          checked={selectedIds.includes(note.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            toggleSelected(note.id, event.target.checked)
                          }
                        />
                      )}
                      <Title
                        level={5}
                        ellipsis={{ rows: 1 }}
                        className="note-title"
                      >
                        {note.title}
                      </Title>
                      <PasswordHealthMark health={note.passwordHealth} />
                    </div>
                    {note.content?.decryptionFailed && (
                      <Text type="danger">Could not decrypt this note</Text>
                    )}

                    {/* Custom Fields as Columns */}
                    {getCustomFields(note.content).length > 0 && (
                      <div className="note-custom-fields">
                        {getCustomFields(note.content).map(
                          (field: any, index: number) => {
                            const fieldKey = `${note.id}-${index}`;
                            const isCopied = copiedFields.has(fieldKey);
                            const isUrlField =
                              field.label.toLowerCase() === "url" &&
                              isURL(field.value);
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
                                className={`custom-field-row ${
                                  isCopied ? "copied" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(
                                    field.value,
                                    fieldKey,
                                    field.label,
                                  );
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
                                      color: isUrlField
                                        ? "var(--colorInfo)"
                                        : undefined,
                                      textDecoration: isUrlField
                                        ? "underline"
                                        : undefined,
                                      marginLeft: 6,
                                      fontFamily:
                                        isPasswordField && !showPassword
                                          ? "monospace"
                                          : undefined,
                                      letterSpacing:
                                        isPasswordField && !showPassword
                                          ? "2px"
                                          : undefined,
                                    }}
                                  >
                                    {displayValue}
                                  </Text>
                                  <div className="field-actions">
                                    {isPasswordField && (
                                      <Tooltip
                                        title={
                                          showPassword
                                            ? "Hide value"
                                            : "Show value"
                                        }
                                      >
                                        {showPassword ? (
                                          <EyeInvisibleOutlined
                                            className="password-toggle-icon"
                                            style={{
                                              color: "var(--iconMuted)",
                                              fontSize: 12,
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              togglePasswordVisibility(
                                                fieldKey,
                                              );
                                            }}
                                          />
                                        ) : (
                                          <EyeOutlined
                                            className="password-toggle-icon"
                                            style={{
                                              color: "var(--iconMuted)",
                                              fontSize: 12,
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              togglePasswordVisibility(
                                                fieldKey,
                                              );
                                            }}
                                          />
                                        )}
                                      </Tooltip>
                                    )}
                                    {isUrlField && (
                                      <Tooltip title="Open URL">
                                        <LinkOutlined
                                          className="link-icon"
                                          style={{
                                            color: "var(--colorInfo)",
                                            fontSize: 12,
                                            marginLeft: 4,
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openURL(field.value);
                                          }}
                                        />
                                      </Tooltip>
                                    )}
                                    {isCopied ? (
                                      <CheckOutlined
                                        className="check-icon"
                                        style={{
                                          color: "#52c41a",
                                          fontSize: 12,
                                          marginLeft: 4,
                                        }}
                                      />
                                    ) : (
                                      <Tooltip title="Click to copy">
                                        <CopyOutlined
                                          className="copy-icon"
                                          style={{ marginLeft: 4 }}
                                        />
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}

                    {/* Main Content */}
                    {typeof note.content === "object" &&
                      note.content.mainContent && (
                        <Paragraph
                          ellipsis={{ rows: 2 }}
                          className="note-content"
                          style={{ marginTop: 8 }}
                        >
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
                </Col>
              ))}
            </Row>
          ) : (
            <Table
              dataSource={filteredNotes}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              columns={getTableColumns()}
              scroll={{ x: 1200 }}
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
          )}
        </Spin>
      )}

      <NoteModal
        visible={modalVisible}
        note={editingNote}
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

      <CollectionsDrawer
        open={collectionsOpen}
        collections={collections}
        onClose={() => setCollectionsOpen(false)}
        onOpen={(collection) => {
          updateSearchParams({ collection: String(collection.id) });
          setCollectionsOpen(false);
        }}
        onCreate={() => openCollectionDialog("create")}
        onRename={(collection) => openCollectionDialog("rename", collection)}
        onShare={(collection) => openCollectionDialog("share", collection)}
        onAddNotes={(collection) => openCollectionDialog("add", collection)}
        onDelete={handleDeleteCollection}
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
