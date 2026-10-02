import { EyeInvisibleOutlined, EyeOutlined, ShareAltOutlined } from "@ant-design/icons";
import { Button, Drawer, Descriptions, Space, Tag, Typography } from "antd";
import { useState } from "react";
import PlatformIcon from "../../components/platformIcon/PlatformIcon";
import { cardBrandFromFields, formatCardField } from "../../utils/cardField";
import { isSecretField } from "../../utils/secretField";

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
  const [shownSecrets, setShownSecrets] = useState<Set<number>>(new Set());
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
  const cardBrand = cardBrandFromFields(customFields);

  return (
    <Drawer
      title={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space size={8}>
            <PlatformIcon note={note} size={28} />
            <Title level={4} style={{ margin: 0 }}>
              {note.title}
            </Title>
          </Space>
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
                note.category === "password" || note.category === "login"
                  ? "red"
                  : note.category === "command"
                  ? "purple"
                  : "blue"
              }
            >
              {note.category === "password" || note.category === "login"
                ? "LOGIN"
                : note.category.toUpperCase()}
            </Tag>
            {note.isShared && (
              <Tag color="purple">
                Shared by {note.sharedByName || "someone"}
              </Tag>
            )}
          </Space>
        </Descriptions.Item>

        {(note.collections?.length || note.collection?.name) && (
          <Descriptions.Item label="Collections">
            <Space size={4} wrap>
              {(note.collections?.length
                ? note.collections
                : [note.collection]
              ).map((collection: { id: number; name: string }) => (
                <Tag key={collection.id} color="processing">
                  {collection.name}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        )}

        {customFields && customFields.length > 0 && (
          <>
            {customFields.map((field: any, index: number) => {
              const secret = isSecretField(field.label);
              const shown = shownSecrets.has(index);
              const value = formatCardField(field.label, String(field.value ?? ""), "", cardBrand);
              return (
                <Descriptions.Item key={index} label={field.label}>
                  <Space size={6}>
                    <span style={{ wordBreak: "break-all" }}>
                      {secret && !shown ? "•".repeat(Math.min(value.length, 12)) : value}
                    </span>
                    {secret && value && (
                      <Button
                        type="text"
                        size="small"
                        aria-label={shown ? "Hide value" : "Show value"}
                        icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() =>
                          setShownSecrets((current) => {
                            const next = new Set(current);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                      />
                    )}
                  </Space>
                </Descriptions.Item>
              );
            })}
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
