import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Col, Form, Input, Modal, Row, Select, Switch } from "antd";
import { useEffect, useState } from "react";
import { useNoteStore, CollectionItem } from "../../store/noteStore";
import {
  CARD_BRANDS,
  cardBrandFromFields,
  cardFieldKind,
  formatCardField,
  cardNumberPlaceholder,
  cvvPlaceholder,
  formatCardNumber,
  formatCvv,
  isAmexBrand,
} from "../../utils/cardField";
import { isSecretField } from "../../utils/secretField";

const { TextArea } = Input;

const generatePassword = (length = 16) => {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => chars[n % chars.length]).join("");
};

interface NoteModalProps {
  visible: boolean;
  note?: any;
  defaultCollectionId?: number;
  collections?: CollectionItem[];
  requireCollection?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface CustomField {
  label: string;
  value: string;
}

const NoteModal = ({
  visible,
  note,
  defaultCollectionId,
  collections: providedCollections,
  requireCollection,
  onClose,
  onSaved,
}: NoteModalProps) => {
  const [form] = Form.useForm();
  const { createNote, updateNote, loading, fetchCollections } = useNoteStore();
  const [selectedCategory, setSelectedCategory] = useState<string>("note");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);

  useEffect(() => {
    if (visible && note) {
      const category = note.category === "login" ? "password" : note.category || "note";
      const collectionIds = note.collections?.length
        ? note.collections.map((collection: { id: number }) => collection.id)
        : note.collectionId
          ? [note.collectionId]
          : [];
      form.setFieldsValue({ ...note, category, collectionIds });
      setSelectedCategory(category);

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
      if (defaultCollectionId) {
        form.setFieldValue("collectionIds", [defaultCollectionId]);
      }
    }
  }, [visible, note, form, defaultCollectionId]);

  useEffect(() => {
    if (!visible) return;
    if (providedCollections) {
      setCollections(providedCollections);
      return;
    }
    fetchCollections()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, [visible, fetchCollections, providedCollections]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);

    // Set predefined fields based on category
    switch (value) {
      case "password":
        setCustomFields([
          { label: "Platform", value: "" },
          { label: "Username", value: "" },
          { label: "Email", value: "" },
          { label: "Password", value: "" },
          { label: "Key/Pass", value: "" },
          { label: "URL", value: "" },
          { label: "2FA", value: "" },
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
      case "address":
        setCustomFields([
          { label: "Full name", value: "" },
          { label: "Organization", value: "" },
          { label: "Email", value: "" },
          { label: "Phone", value: "" },
          { label: "Address", value: "" },
          { label: "Address 2", value: "" },
          { label: "City", value: "" },
          { label: "State", value: "" },
          { label: "Postal code", value: "" },
          { label: "Country", value: "" },
        ]);
        break;
      case "card":
        setCustomFields([
          { label: "Cardholder", value: "" },
          { label: "Brand", value: "" },
          { label: "Number", value: "" },
          { label: "Expires", value: "" },
          { label: "CVV", value: "" },
          { label: "PIN", value: "" },
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

  const setBrand = (brand: string) => {
    setCustomFields((current) =>
      current.map((field) => {
        const kind = cardFieldKind(field.label);
        if (kind === "brand") return { ...field, value: brand };
        if (kind === "number") return { ...field, value: formatCardNumber(field.value, brand) };
        if (kind === "cvv") return { ...field, value: formatCvv(field.value, brand) };
        return field;
      })
    );
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

      const canChooseCollection = !note || note.isOwner;
      if (canChooseCollection) {
        values.collectionIds = values.collectionIds || [];
      } else {
        delete values.collectionIds;
      }
      delete values.collectionId;

      if (note) {
        await updateNote(note.id, values);
      } else {
        await createNote(values);
      }

      form.resetFields();
      setCustomFields([]);
      onSaved?.();
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
              if (value === "password" || value === "address" || value === "card") {
                form.setFieldValue("isEncrypted", true);
              }
            }}
          >
            <Select.Option value="note">Note</Select.Option>
            <Select.Option value="password">Login</Select.Option>
            <Select.Option value="command">Command</Select.Option>
            <Select.Option value="ssh">SSH</Select.Option>
            <Select.Option value="db">Database</Select.Option>
            <Select.Option value="address">Address</Select.Option>
            <Select.Option value="card">Card</Select.Option>
            <Select.Option value="other">Other</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="collectionIds"
          label="Collections"
          rules={
            requireCollection
              ? [
                  {
                    validator: (_, value) =>
                      Array.isArray(value) && value.length
                        ? Promise.resolve()
                        : Promise.reject(new Error("Choose a collection")),
                  },
                ]
              : undefined
          }
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="No collection"
            disabled={!!note && !note.isOwner}
            options={collections
              .filter(
                (collection) =>
                  collection.permission === "owner" ||
                  collection.permission === "edit" ||
                  note?.collections?.some(
                    (item: { id: number }) => item.id === collection.id
                  ) ||
                  collection.id === note?.collectionId
              )
              .map((collection) => ({
                value: collection.id,
                label: collection.name,
              }))}
          />
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
            {customFields.map((field, index) => {
              const brand = cardBrandFromFields(customFields);
              const amex = isAmexBrand(brand);
              const kind = cardFieldKind(field.label);
              return (
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
                  {kind === "brand" ? (
                    <Select
                      placeholder="Brand"
                      value={field.value || undefined}
                      style={{ width: "100%" }}
                      options={(
                        field.value &&
                        !CARD_BRANDS.includes(field.value as (typeof CARD_BRANDS)[number])
                          ? [field.value, ...CARD_BRANDS]
                          : [...CARD_BRANDS]
                      ).map((item) => ({ value: item, label: item }))}
                      onChange={setBrand}
                    />
                  ) : isSecretField(field.label) ? (
                    <Input.Password
                      key={kind === "cvv" ? `cvv-${brand}` : undefined}
                      placeholder={kind === "cvv" ? cvvPlaceholder(brand) : "Value"}
                      inputMode={kind === "cvv" ? "numeric" : undefined}
                      maxLength={kind === "cvv" ? (amex ? 4 : 3) : undefined}
                      value={formatCardField(field.label, field.value, "", brand)}
                      onChange={(e) =>
                        updateCustomField(
                          index,
                          "value",
                          formatCardField(field.label, e.target.value, field.value, brand)
                        )
                      }
                    />
                  ) : (
                    <Input
                      key={kind === "number" ? `number-${brand}` : undefined}
                      placeholder={
                        kind === "number"
                          ? cardNumberPlaceholder(brand)
                          : kind === "expires"
                            ? "MM/YY"
                            : "Value"
                      }
                      inputMode={kind ? "numeric" : undefined}
                      maxLength={
                        kind === "number" ? (amex ? 17 : 19) : kind === "expires" ? 5 : undefined
                      }
                      value={formatCardField(field.label, field.value, "", brand)}
                      onChange={(e) =>
                        updateCustomField(
                          index,
                          "value",
                          formatCardField(field.label, e.target.value, field.value, brand)
                        )
                      }
                    />
                  )}
                </Col>
                {field.label.toLowerCase().includes("pass") && (
                  <Col>
                    <Button
                      type="link"
                      size="small"
                      onClick={() =>
                        updateCustomField(index, "value", generatePassword())
                      }
                    >
                      Generate
                    </Button>
                  </Col>
                )}
                <Col>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeCustomField(index)}
                  />
                </Col>
              </Row>
              );
            })}
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
