import { Drawer, Descriptions, Tag, Typography } from "antd";

const { Paragraph, Title } = Typography;

interface NoteViewModalProps {
  visible: boolean;
  note: any;
  onClose: () => void;
}

const NoteViewModal = ({ visible, note, onClose }: NoteViewModalProps) => {
  if (!note) return null;

  const parseContent = (content: any) => {
    // If content is already an object, return it
    if (typeof content === "object" && content !== null) {
      return {
        mainContent: content.mainContent || "",
        customFields: content.customFields || [],
      };
    }
    // If it's a string, try to parse it
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
        <Title level={4} style={{ margin: 0 }}>
          {note.title}
        </Title>
      }
      open={visible}
      onClose={onClose}
      width={600}
      placement="right"
    >
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Category">
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
