import { DeleteOutlined, UserAddOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Form,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { NoteShare, useNoteStore } from "../../store/noteStore";

const { Text } = Typography;

function expiryLabel(expiresAt?: string | null) {
  if (!expiresAt) return "No expiry";
  const date = new Date(expiresAt);
  if (date.getTime() <= Date.now()) return "Expired";
  return `Expires ${date.toLocaleDateString()}`;
}

function expiryColor(expiresAt?: string | null) {
  if (!expiresAt) return "default";
  return new Date(expiresAt).getTime() <= Date.now() ? "red" : "gold";
}

interface ShareModalProps {
  visible: boolean;
  note: any;
  onClose: () => void;
}

const ShareModal = ({ visible, note, onClose }: ShareModalProps) => {
  const { shareNote, getNoteShares, revokeShare, searchUsers } = useNoteStore();
  const [form] = Form.useForm();
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userOptions, setUserOptions] = useState<
    { value: string; label: string; name: string; email: string }[]
  >([]);
  const searchTimer = useRef<number>();

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

  const loadShares = async () => {
    if (!note?.id) return;
    setLoading(true);
    try {
      const data = await getNoteShares(note.id);
      setShares(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to load shares");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && note?.id) {
      loadShares();
      form.resetFields();
    }
  }, [visible, note?.id]);

  const handleShare = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const result = await shareNote(
        note.id,
        values.identifiers,
        values.permission,
        values.expiresIn
      );

      if (result.shared?.length) {
        message.success(
          result.shared.length === 1
            ? "Note shared successfully"
            : `Shared with ${result.shared.length} users`
        );
      }

      if (result.failed?.length) {
        message.warning({
          className: "share-message-left",
          content: (
            <div className="share-error-list">
              {result.failed.map((f) => (
                <div key={f.identifier}>{f.message}</div>
              ))}
            </div>
          ),
        });
      }

      if (result.shared?.length) {
        onClose();
        return;
      }

      form.resetFields(["identifiers"]);
      await loadShares();
    } catch (error: any) {
      if (error?.errorFields) return;

      // axios interceptor rejects with response.data directly
      const apiError = error?.response?.data || error;
      const failed = apiError?.failed as
        | { identifier: string; message: string }[]
        | undefined;

      if (failed?.length) {
        message.error({
          className: "share-message-left",
          content: (
            <div className="share-error-list">
              {failed.map((f) => (
                <div key={f.identifier}>{f.message}</div>
              ))}
            </div>
          ),
        });
      } else {
        message.error(apiError?.message || "Failed to share note");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId: number) => {
    try {
      await revokeShare(note.id, userId);
      message.success("Access revoked");
      await loadShares();
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to revoke share");
    }
  };

  return (
    <Modal
      title={`Share "${note?.title || "Note"}"`}
      open={visible}
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
          rules={[
            {
              required: true,
              type: "array",
              min: 1,
              message: "Add at least one email or username",
            },
          ]}
          extra="Type at least 2 characters, then pick a user"
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
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {option.data.email}
                </span>
              </div>
            )}
            popupMatchSelectWidth={false}
            dropdownStyle={{ minWidth: 320 }}
            placeholder="Search by email or username"
            suffixIcon={<UserAddOutlined />}
            notFoundContent={null}
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
              { value: "1", label: "In 1 day" },
              { value: "7", label: "In 7 days" },
              { value: "30", label: "In 30 days" },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            Share
          </Button>
        </Form.Item>
      </Form>

      <Text strong style={{ display: "block", marginBottom: 8 }}>
        People with access ({shares.length})
      </Text>
      <List
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Not shared with anyone yet"
            />
          ),
        }}
        dataSource={shares}
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
              title={
                share.sharedWith?.fullName ||
                share.sharedWith?.username ||
                `User #${share.sharedWithUserId}`
              }
              description={
                <Space wrap>
                  <Text type="secondary">{share.sharedWith?.email}</Text>
                  <Tag color={share.permission === "edit" ? "blue" : "default"}>
                    {share.permission}
                  </Tag>
                  <Tag color={expiryColor(share.expiresAt)}>
                    {expiryLabel(share.expiresAt)}
                  </Tag>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default ShareModal;
