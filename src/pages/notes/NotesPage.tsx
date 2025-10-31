import {
  AppstoreOutlined,
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
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
import { useEffect, useState } from "react";
import { useNoteStore } from "../../store/noteStore";
import NoteModal from "./NoteModal";
import "./NotesPage.scss";
import NoteViewModal from "./NoteViewModal";
import dayjsExtra from "../../utils/dayjs";

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

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
    toggleFavorite,
    getProjects,
  } = useNoteStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [projects, setProjects] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    const saved = localStorage.getItem("notesViewMode");
    return (saved as "card" | "table") || "card";
  });
  const [copiedFields, setCopiedFields] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set()
  );

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
    fetchNotes();
    loadProjects();
  }, [fetchNotes]);

  useEffect(() => {
    // Extract unique tags from all notes whenever notes change
    const allTags = notes.flatMap((note) => note.tags || []);
    const uniqueTags = Array.from(new Set(allTags)).sort();
    setAvailableTags(uniqueTags);
  }, [notes]);

  const loadProjects = async () => {
    try {
      const projectList = await getProjects();
      setProjects(projectList);
    } catch (error) {
      console.error("Failed to load projects");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      message.success("Note deleted successfully");
    } catch (error) {
      message.error("Failed to delete note");
    }
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

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    fetchNotes({
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      search: value,
    });
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    fetchNotes({
      category: category !== "all" ? category : undefined,
      project: selectedProject !== "all" ? selectedProject : undefined,
      search: searchQuery,
    });
  };

  const handleProjectChange = (project: string) => {
    setSelectedProject(project);
    fetchNotes({
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      project: project !== "all" ? project : undefined,
      search: searchQuery,
    });
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
  };

  const getCategoryColor = (category: string) => {
    return categories.find((c) => c.value === category)?.color || "default";
  };

  // Filter notes by selected tag on the frontend
  const filteredNotes =
    selectedTag === "all"
      ? notes
      : notes.filter((note) => note.tags && note.tags.includes(selectedTag));

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
      }
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
        render: (text: string) => (
          <Text strong style={{ cursor: "pointer" }}>
            {text}
          </Text>
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
        title: "Project",
        dataIndex: "project",
        key: "project",
        width: 120,
        ellipsis: true,
        render: (project: string) =>
          project ? (
            <Tag color="processing" style={{ margin: 0 }}>
              {project}
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
                    "Main Content"
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
        width: 120,
        fixed: "right" as const,
        render: (_: any, record: any) => (
          <Space size="small">
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
          </Space>
        ),
      },
    ];
  };

  return (
    <div className="notes-page">
      <div className="notes-header">
        <Segmented
          className="switcher"
          value={viewMode}
          onChange={(value) => handleViewModeChange(value as "card" | "table")}
          style={{ padding: "6px" }}
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
        <div className="notes-filters">
          <Space
            size="middle"
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space size="middle" wrap>
              <Select
                value={selectedCategory}
                onChange={handleCategoryChange}
                style={{ width: 150 }}
                popupClassName="notes-select-dropdown"
                options={categories}
              />
              <Select
                value={selectedProject}
                onChange={handleProjectChange}
                style={{ width: 180 }}
                placeholder="Filter by project"
                popupClassName="notes-select-dropdown"
              >
                <Select.Option value="all">All Projects</Select.Option>
                {projects.map((project) => (
                  <Select.Option key={project} value={project}>
                    {project}
                  </Select.Option>
                ))}
              </Select>
              <Select
                value={selectedTag}
                onChange={handleTagChange}
                style={{ width: 150 }}
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
              <Search
                placeholder="Search notes..."
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
                prefix={<SearchOutlined />}
              />
            </Space>
          </Space>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
          size="large"
        >
          New Note
        </Button>
      </div>

      {loading ? (
        <div className="notes-loading">
          <Spin size="large" />
        </div>
      ) : filteredNotes.length === 0 ? (
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
                  <Button
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
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(note);
                    }}
                  />,
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(note);
                    }}
                  />,
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(note.id);
                    }}
                  />,
                ]}
              >
                <div className="note-card-header">
                  <Tag color={getCategoryColor(note.category)}>
                    {note.category.toUpperCase()}
                  </Tag>
                  {note.isFavorite && (
                    <StarFilled style={{ color: "#faad14", fontSize: 16 }} />
                  )}
                </div>
                <Title level={5} ellipsis={{ rows: 1 }} className="note-title">
                  {note.title}
                </Title>

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
                                field.label
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
                                      showPassword ? "Hide value" : "Show value"
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
                                          togglePasswordVisibility(fieldKey);
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
                      }
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
          onRow={(record) => ({
            onClick: () => handleView(record),
            style: { cursor: "pointer" },
          })}
          size="middle"
        />
      )}

      <NoteModal
        visible={modalVisible}
        note={editingNote}
        onClose={handleModalClose}
      />

      <NoteViewModal
        visible={viewModalVisible}
        note={viewingNote}
        onClose={handleViewModalClose}
      />
    </div>
  );
};

export default NotesPage;
