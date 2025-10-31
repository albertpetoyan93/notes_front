import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Col, Form, Input, Modal, Row, Select, Switch } from "antd";
import { useEffect, useState } from "react";
import { useNoteStore } from "../../store/noteStore";

const { TextArea } = Input;

interface NoteModalProps {
  visible: boolean;
  note?: any;
  onClose: () => void;
}

interface CustomField {
  label: string;
  value: string;
}

const NoteModal = ({ visible, note, onClose }: NoteModalProps) => {
  const [form] = Form.useForm();
  const { createNote, updateNote, loading, fetchNotes } = useNoteStore();
  const [selectedCategory, setSelectedCategory] = useState<string>("note");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (visible && note) {
      form.setFieldsValue(note);
      setSelectedCategory(note.category || "note");

      // Parse custom fields from content if it's an object (JSONB)
      const content = note.content;
      if (typeof content === "object" && content !== null) {
        if (content.customFields) {
          setCustomFields(content.customFields);
          form.setFieldValue("content", content.mainContent || "");
        }
      } else if (typeof content === "string") {
        // Try to parse if it's a JSON string (legacy)
        try {
          const parsedContent = JSON.parse(content);
          if (parsedContent.customFields) {
            setCustomFields(parsedContent.customFields);
            form.setFieldValue("content", parsedContent.mainContent || "");
          }
        } catch {
          // If not JSON, treat as regular content
          setCustomFields([]);
        }
      }
    } else if (visible) {
      form.resetFields();
      setSelectedCategory("note");
      setCustomFields([]);
    }
  }, [visible, note, form]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);

    // Set predefined fields based on category
    switch (value) {
      case "password":
        setCustomFields([
          { label: "Platform/Website", value: "" },
          { label: "Username/Email", value: "" },
          { label: "Password", value: "" },
          { label: "Key/Password", value: "" },
          { label: "URL", value: "" },
        ]);
        break;
      case "login":
        setCustomFields([
          { label: "Service Name", value: "" },
          { label: "Username", value: "" },
          { label: "Email", value: "" },
          { label: "Password", value: "" },
          { label: "Key/Password", value: "" },
          { label: "2FA/Security", value: "" },
        ]);
        break;
      case "command":
        setCustomFields([{ label: "Command", value: "" }]);
        break;
      case "ssh":
        setCustomFields([
          { label: "Host", value: "" },
          { label: "Port", value: "22" },
          { label: "Username", value: "" },
          { label: "Password", value: "" },
          { label: "SSH Key Path", value: "" },
          { label: "Connection String", value: "" },
        ]);
        break;
      case "db":
        setCustomFields([
          { label: "DB_HOST", value: "localhost" },
          { label: "DB_PORT", value: "5432" },
          { label: "DB_USER", value: "" },
          { label: "DB_NAME", value: "" },
          { label: "DB_PASSWORD", value: "" },
        ]);
        break;
      default:
        setCustomFields([]);
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { label: "", value: "" }]);
  };

  const removeCustomField = (index: number) => {
    const newFields = customFields.filter((_, i) => i !== index);
    setCustomFields(newFields);
  };

  const updateCustomField = (
    index: number,
    field: "label" | "value",
    newValue: string
  ) => {
    const newFields = [...customFields];
    newFields[index][field] = newValue;
    setCustomFields(newFields);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Build content object based on whether there are custom fields
      if (customFields.length > 0) {
        values.content = {
          mainContent: values.content || "",
          customFields: customFields,
        };
      } else {
        // For simple notes, still use object structure
        values.content = {
          mainContent: values.content || "",
          customFields: [],
        };
      }

      if (note) {
        await updateNote(note.id, values);
      } else {
        await createNote(values);
      }

      // Refresh notes list
      await fetchNotes();

      form.resetFields();
      setCustomFields([]);
      onClose();
    } catch (error) {
      // Error handling is done in the hook
      console.error("Failed to save note:", error);
    }
  };

  return (
    <Modal
      title={note ? "Edit Note" : "Create New Note"}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      width={600}
      okText={note ? "Update" : "Create"}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          category: "note",
          isFavorite: false,
          isEncrypted: false,
          tags: [],
        }}
      >
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: "Please enter a title" }]}
        >
          <Input placeholder="Enter note title" />
        </Form.Item>

        <Form.Item
          name="category"
          label="Category"
          rules={[{ required: true, message: "Please select a category" }]}
        >
          <Select
            onChange={(value) => {
              handleCategoryChange(value);
              // Auto-enable encryption for password and login
              if (value === "password" || value === "login") {
                form.setFieldValue("isEncrypted", true);
              }
            }}
          >
            <Select.Option value="note">Note</Select.Option>
            <Select.Option value="password">Password</Select.Option>
            <Select.Option value="login">Login</Select.Option>
            <Select.Option value="command">Command</Select.Option>
            <Select.Option value="ssh">SSH</Select.Option>
            <Select.Option value="db">Database</Select.Option>
            <Select.Option value="other">Other</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="project" label="Project (optional)">
          <Input placeholder="e.g., Website Redesign, API Backend, etc." />
        </Form.Item>

        {/* Custom Fields Section */}
        {customFields.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <strong>Custom Fields:</strong>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={addCustomField}
              >
                Add Field
              </Button>
            </div>
            {customFields.map((field, index) => (
              <Row
                key={index}
                gutter={[8, 8]}
                align="middle"
                style={{ marginBottom: 8 }}
              >
                <Col>
                  <Input
                    placeholder="Field name"
                    value={field.label}
                    onChange={(e) =>
                      updateCustomField(index, "label", e.target.value)
                    }
                    style={{ width: 150 }}
                  />
                </Col>
                <Col flex="auto">
                  <Input
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) =>
                      updateCustomField(index, "value", e.target.value)
                    }
                  />
                </Col>
                <Col>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeCustomField(index)}
                  />
                </Col>
              </Row>
            ))}
          </div>
        )}

        {customFields.length === 0 && selectedCategory !== "note" && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addCustomField}
            style={{ marginBottom: 16, width: "100%" }}
          >
            Add Custom Fields
          </Button>
        )}

        <Form.Item
          name="content"
          label={customFields.length > 0 ? "Additional Notes" : "Content"}
          rules={
            customFields.length > 0
              ? []
              : [{ required: true, message: "Please enter content" }]
          }
        >
          <TextArea
            rows={customFields.length > 0 ? 4 : 4}
            placeholder={
              customFields.length > 0
                ? "Any additional notes... (optional)"
                : "Enter your note content..."
            }
          />
        </Form.Item>

        <Form.Item name="tags" label="Tags">
          <Select
            mode="tags"
            placeholder="Add tags (press Enter to add)"
            style={{ width: "100%" }}
          />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Form.Item
            name="isFavorite"
            label="Mark as Favorite"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isEncrypted"
            label="Encrypt Content"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default NoteModal;
