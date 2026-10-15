import { message } from "antd";
import { useCallback, useState } from "react";

// Copy and show/hide state for note fields, keyed by a per-field string.
const useFieldClipboard = () => {
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Set<string>>(new Set());

  const copy = useCallback((text: string, key: string, label?: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied((prev) => new Set(prev).add(key));
        window.setTimeout(() => {
          setCopied((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 2000);
        message.success(`${label || "Text"} copied`, 1.5);
      },
      () => message.error("Failed to copy to clipboard")
    );
  }, []);

  const toggleVisible = useCallback((key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return {
    copy,
    toggleVisible,
    isCopied: (key: string) => copied.has(key),
    isVisible: (key: string) => visible.has(key),
  };
};

export type FieldClipboard = ReturnType<typeof useFieldClipboard>;
export default useFieldClipboard;
