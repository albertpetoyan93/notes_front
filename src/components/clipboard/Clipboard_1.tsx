import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { useState } from "react";
import CopyToClipboard from "react-copy-to-clipboard";

interface ClipboardProps {
  value: string;
}

const Clipboard_1 = ({ value }: ClipboardProps) => {
  const [copied, setCopied] = useState(false);

  const setCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div style={{ display: "flex", alignItems: "start" }}>
      <CopyToClipboard text={value} onCopy={() => setCopy()}>
        <span style={{ marginLeft: 10, cursor: "pointer" }}>
          {copied ? (
            <CheckOutlined className="icon" style={{ color: "green" }} />
          ) : (
            <CopyOutlined className="icon" />
          )}
        </span>
      </CopyToClipboard>
    </div>
  );
};

export default Clipboard_1;
