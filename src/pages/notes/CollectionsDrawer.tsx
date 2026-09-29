import {
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  PlusOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Empty, theme, Tooltip, Typography } from "antd";
import { CollectionItem } from "../../store/noteStore";

const { Text } = Typography;

interface CollectionsDrawerProps {
  open: boolean;
  collections: CollectionItem[];
  onClose: () => void;
  onOpen: (collection: CollectionItem) => void;
  onCreate: () => void;
  onRename: (collection: CollectionItem) => void;
  onShare: (collection: CollectionItem) => void;
  onAddNotes: (collection: CollectionItem) => void;
  onDelete: (collection: CollectionItem) => void;
}

const CollectionsDrawer = ({
  open,
  collections,
  onClose,
  onOpen,
  onCreate,
  onRename,
  onShare,
  onAddNotes,
  onDelete,
}: CollectionsDrawerProps) => {
  const { token } = theme.useToken();

  return (
    <Drawer
      title="Collections"
      open={open}
      onClose={onClose}
      width={440}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          New
        </Button>
      }
    >
      {collections.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No collections yet"
        />
      ) : (
        collections.map((collection) => {
          const canEdit =
            collection.permission === "owner" || collection.permission === "edit";
          return (
            <div
              key={collection.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 4px",
                borderBottom: `1px solid ${token.colorSplit}`,
              }}
            >
              <button
                type="button"
                onClick={() => onOpen(collection)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: token.borderRadius,
                  color: token.colorText,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {collection.name}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {collection.noteCount}{" "}
                  {collection.noteCount === 1 ? "note" : "notes"}
                  {!collection.isOwner ? " · Shared with you" : ""}
                </Text>
              </button>
              <div style={{ display: "flex", flexShrink: 0 }}>
                {canEdit && (
                  <Tooltip title="Add notes">
                    <Button
                      type="text"
                      icon={<FileAddOutlined />}
                      aria-label="Add notes"
                      onClick={() => onAddNotes(collection)}
                    />
                  </Tooltip>
                )}
                {collection.isOwner && (
                  <>
                    <Tooltip title="Share">
                      <Button
                        type="text"
                        icon={<ShareAltOutlined />}
                        aria-label="Share"
                        onClick={() => onShare(collection)}
                      />
                    </Tooltip>
                    <Tooltip title="Rename">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        aria-label="Rename"
                        onClick={() => onRename(collection)}
                      />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="Delete"
                        onClick={() => onDelete(collection)}
                      />
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </Drawer>
  );
};

export default CollectionsDrawer;
