import {
  CheckOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { MouseEvent, ReactNode } from "react";
import type { FieldClipboard } from "../../hooks/useFieldClipboard";
import { openURL } from "../../utils/isUrl";
import "./FieldActions.scss";

interface FieldActionsProps {
  fieldKey: string;
  label: string;
  /** The text that is copied (already formatted for display). */
  value: string;
  secret?: boolean;
  url?: boolean;
  clipboard: FieldClipboard;
}

const ActionButton = ({
  title,
  icon,
  onClick,
  pressed,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
}) => (
  <Tooltip title={title}>
    <Button
      type="text"
      size="small"
      className="field-action"
      aria-label={title}
      aria-pressed={pressed}
      icon={icon}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
    />
  </Tooltip>
);

// Reveal, open and copy buttons for one field. Real buttons, so they work from the keyboard.
const FieldActions = ({ fieldKey, label, value, secret, url, clipboard }: FieldActionsProps) => {
  const shown = clipboard.isVisible(fieldKey);
  const copied = clipboard.isCopied(fieldKey);

  return (
    <span className="field-actions">
      {secret && (
        <ActionButton
          title={shown ? `Hide ${label}` : `Show ${label}`}
          icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          pressed={shown}
          onClick={() => clipboard.toggleVisible(fieldKey)}
        />
      )}
      {url && (
        <ActionButton title={`Open ${label}`} icon={<LinkOutlined />} onClick={() => openURL(value)} />
      )}
      <ActionButton
        title={copied ? "Copied" : `Copy ${label}`}
        icon={copied ? <CheckOutlined className="field-copied" /> : <CopyOutlined />}
        onClick={() => clipboard.copy(value, fieldKey, label)}
      />
    </span>
  );
};

export default FieldActions;
