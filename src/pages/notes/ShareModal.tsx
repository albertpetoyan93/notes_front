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
import { useEffect, useState } from "react";
import { NoteShare, useNoteStore } from "../../store/noteStore";

const { Text } = Typography;

interface ShareModalProps {
  visible: boolean;
  note: any;
  onClose: () => void;
}

const ShareModal = ({ visible, note, onClose }: ShareModalProps) => {
  const { shareNote, getNoteShares, revokeShare } = useNoteStore();
  const [form] = Form.useForm();
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        values.permission
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
        initialValues={{ permission: "view", identifiers: [] }}
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
          extra="Type an email or username and press Enter to add more"
        >
          <Select
            mode="tags"
            tokenSeparators={[",", " ", ";"]}
            placeholder="Add emails or usernames..."
            suffixIcon={<UserAddOutlined />}
            open={false}
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
                <Space>
                  <Text type="secondary">{share.sharedWith?.email}</Text>
                  <Tag color={share.permission === "edit" ? "blue" : "default"}>
                    {share.permission}
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
