import { DeleteOutlined, UserAddOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { CollectionItem, useNoteStore } from "../../store/noteStore";
import { isPlanLimit, planAllows } from "../../store/billingStore";
import { moveToCompanyText } from "../../utils/ownership";

const { Text } = Typography;

/**
 * Ask, then delete a collection. Deleting drops its sharing for good. A company
 * collection is refused while it is the only company collection of an item; the
 * server's reason is shown.
 */
export const confirmDeleteCollection = ({
  collection,
  inCompany,
  onDeleted,
}: {
  collection: { id: number; name: string };
  inCompany: boolean;
  onDeleted: () => void;
}) =>
  Modal.confirm({
    title: `Delete "${collection.name}"?`,
    content: inCompany
      ? "Everyone loses access through this collection. Company items in it must also be in another company collection; if one isn't, the collection isn't deleted."
      : "Notes in this collection stay in your list, without a collection.",
    okText: "Delete",
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await useNoteStore.getState().deleteCollection(collection.id);
      } catch (error: any) {
        message.error(error?.message || "Could not delete the collection");
        return;
      }
      message.success("Collection deleted");
      onDeleted();
    },
  });

interface CollectionDialogsProps {
  mode: "create" | "rename" | "add" | "share" | null;
  collection?: CollectionItem | null;
  /** Set when the collection belongs to this company: adding moves the items into it. */
  companyName?: string | null;
  /** Set for a company collection, so a rename finds its (possibly encrypted) name. */
  companyId?: number | null;
  onClose: () => void;
  onChanged: () => void;
}

const CollectionDialogs = ({
  mode,
  collection,
  companyName,
  companyId,
  onClose,
  onChanged,
}: CollectionDialogsProps) => {
  const {
    createCollection,
    renameCollection,
    availableCollectionNotes,
    addNotesToCollection,
    searchUsers,
    shareCollection,
    getCollectionShares,
    revokeCollectionShare,
  } = useNoteStore();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [noteOptions, setNoteOptions] = useState<{ value: number; label: string }[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<
    { value: string; label: string; name: string; email: string }[]
  >([]);
  const searchTimer = useRef<number>();

  useEffect(() => {
    if (mode === "rename" && collection) {
      form.setFieldsValue({ name: collection.name });
    }
    if (mode === "create") {
      form.resetFields();
    }
    if (mode === "add" && collection) {
      form.resetFields();
      availableCollectionNotes(collection.id)
        .then((notes) =>
          setNoteOptions(notes.map((note) => ({ value: note.id, label: note.title })))
        )
        .catch(() => setNoteOptions([]));
    }
    if (mode === "share" && collection) {
      form.setFieldsValue({ permission: "view", identifiers: [], expiresIn: "never" });
      getCollectionShares(collection.id)
        .then(setShares)
        .catch(() => setShares([]));
    }
  }, [mode, collection?.id]);

  const handleUserSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    const query = value.trim();
    if (query.length < 2) {
      setUserOptions([]);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      try {
        const users = await searchUsers(query);
        setUserOptions(
          users.map((user) => ({
            value: user.email,
            label: user.email,
            name: user.fullName || user.username,
            email: user.email,
          }))
        );
      } catch {
        setUserOptions([]);
      }
    }, 300);
  };

  const handleName = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createCollection(values.name);
        message.success("Collection created");
      } else if (collection) {
        await renameCollection(collection.id, values.name, companyId);
        message.success("Collection renamed");
      }
      onChanged();
      onClose();
    } catch (error: any) {
      if (isPlanLimit(error)) return;
      message.error(error?.message || "Could not save collection");
    } finally {
      setSubmitting(false);
    }
  };

  // Your items added to a company collection become the company's: asked once for all of them.
  const confirmMove = (name: string) =>
    new Promise<boolean>((resolve) =>
      Modal.confirm({
        title: moveToCompanyText(name),
        okText: "Move",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    );

  const handleAdd = async () => {
    if (!collection) return;
    const values = await form.validateFields();
    if (companyName && !(await confirmMove(companyName))) return;
    setSubmitting(true);
    try {
      const result = await addNotesToCollection(collection.id, values.noteIds);
      message.success(
        result.added === 1 ? "Note added" : `Added ${result.added} notes`
      );
      onChanged();
      onClose();
    } catch (error: any) {
      message.error(error?.message || "Could not add notes");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!collection) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const result = await shareCollection(
        collection.id,
        values.identifiers,
        values.permission,
        values.expiresIn
      );
      if (result.shared?.length) {
        message.success("Collection shared");
        onChanged();
        onClose();
        return;
      }
      if (result.failed?.length) {
        message.error(result.failed.map((item: any) => item.message).join("\n"));
      }
    } catch (error: any) {
      if (isPlanLimit(error)) return;
      const failed = error?.failed as { message: string }[] | undefined;
      message.error(
        failed?.map((item) => item.message).join("\n") ||
          error?.message ||
          "Could not share collection"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId: number) => {
    if (!collection) return;
    await revokeCollectionShare(collection.id, userId);
    message.success("Access revoked");
    setShares(await getCollectionShares(collection.id));
  };

  return (
    <>
      <Modal
        title={mode === "rename" ? "Rename collection" : "New collection"}
        open={mode === "create" || mode === "rename"}
        onCancel={onClose}
        onOk={handleName}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Enter a name" }]}
          >
            <Input placeholder="Collection name" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Add notes to "${collection?.name || ""}"`}
        open={mode === "add"}
        onCancel={onClose}
        onOk={handleAdd}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="noteIds"
            label="Notes you own"
            rules={[{ required: true, message: "Choose at least one note" }]}
          >
            <Select
              mode="multiple"
              options={noteOptions}
              placeholder="Choose existing notes"
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Share "${collection?.name || ""}"`}
        open={mode === "share"}
        onCancel={onClose}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ permission: "view", identifiers: [], expiresIn: "never" }}
          onFinish={handleShare}
        >
          <Form.Item
            name="identifiers"
            label="Users (email or username)"
            rules={[{ required: true, type: "array", min: 1, message: "Add a user" }]}
          >
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              onSearch={handleUserSearch}
              options={userOptions}
              optionRender={(option) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>{option.data.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{option.data.email}</span>
                </div>
              )}
              placeholder="Search by email or username"
              suffixIcon={<UserAddOutlined />}
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 320 }}
            />
          </Form.Item>
          <Form.Item name="permission" label="Permission">
            <Select
              options={[
                { value: "view", label: "View only" },
                { value: "edit", label: "Can edit" },
              ]}
            />
          </Form.Item>
          <Form.Item name="expiresIn" label="Access expires">
            <Select
              options={[
                { value: "never", label: "Never" },
                ...["1", "7", "30"].map((days) => ({
                  value: days,
                  label: `In ${days} ${days === "1" ? "day" : "days"}${planAllows("shareExpiry") ? "" : " (Premium)"}`,
                  disabled: !planAllows("shareExpiry"),
                })),
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            Share
          </Button>
        </Form>
        <Text strong style={{ display: "block", margin: "16px 0 8px" }}>
          People with access ({shares.length})
        </Text>
        <List
          dataSource={shares}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not shared yet" /> }}
          renderItem={(share) => (
            <List.Item
              actions={[
                <Button
                  key="revoke"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRevoke(share.sharedWithUserId)}
                >
                  Revoke
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={share.sharedWith?.fullName || share.sharedWith?.username}
                description={
                  <Space>
                    <Text type="secondary">{share.sharedWith?.email}</Text>
                    <Tag>{share.permission}</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
};

export default CollectionDialogs;
