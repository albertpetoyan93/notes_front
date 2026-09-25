import { ShareAltOutlined } from "@ant-design/icons";
import { Button, Drawer, Descriptions, Space, Tag, Typography } from "antd";

const { Paragraph, Title } = Typography;

interface NoteViewModalProps {
  visible: boolean;
  note: any;
  onClose: () => void;
  onShare?: () => void;
}

const NoteViewModal = ({
  visible,
  note,
  onClose,
  onShare,
}: NoteViewModalProps) => {
  if (!note) return null;

  const parseContent = (content: any) => {
    if (typeof content === "object" && content !== null) {
      return {
        mainContent: content.mainContent || "",
        customFields: content.customFields || [],
      };
    }
    try {
      return JSON.parse(content);
    } catch {
      return { mainContent: content, customFields: [] };
    }
  };

  const { mainContent, customFields } = parseContent(note.content);

  return (
    <Drawer
      title={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Title level={4} style={{ margin: 0 }}>
            {note.title}
          </Title>
          {onShare && (
            <Button
              type="text"
              icon={<ShareAltOutlined />}
              onClick={onShare}
            >
              Share
            </Button>
          )}
        </Space>
      }
      open={visible}
      onClose={onClose}
      width={600}
      placement="right"
    >
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Category">
          <Space>
            <Tag
              color={
                note.category === "password"
                  ? "red"
                  : note.category === "login"
                  ? "green"
                  : note.category === "command"
                  ? "purple"
                  : "blue"
              }
            >
              {note.category.toUpperCase()}
            </Tag>
            {note.isShared && <Tag color="purple">Shared with you</Tag>}
          </Space>
        </Descriptions.Item>

        {note.project && (
          <Descriptions.Item label="Project">
            <Tag color="processing">{note.project}</Tag>
          </Descriptions.Item>
        )}

        {customFields && customFields.length > 0 && (
          <>
            {customFields.map((field: any, index: number) => (
              <Descriptions.Item key={index} label={field.label}>
                <span style={{ wordBreak: "break-all" }}>
                  {String(field.value)}
                </span>
              </Descriptions.Item>
            ))}
          </>
        )}

        {mainContent && (
          <Descriptions.Item
            label={customFields.length > 0 ? "Additional Notes" : "Content"}
          >
            <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {mainContent}
            </Paragraph>
          </Descriptions.Item>
        )}

        {note.comment && (
          <Descriptions.Item label="Comment">
            <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {note.comment}
            </Paragraph>
          </Descriptions.Item>
        )}

        {note.tags && note.tags.length > 0 && (
          <Descriptions.Item label="Tags">
            {note.tags.map((tag: string, index: number) => (
              <Tag key={index}>{tag}</Tag>
            ))}
          </Descriptions.Item>
        )}

        <Descriptions.Item label="Created">
          {new Date(note.createdAt).toLocaleString()}
        </Descriptions.Item>

        <Descriptions.Item label="Last Updated">
          {new Date(note.updatedAt).toLocaleString()}
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};

export default NoteViewModal;
