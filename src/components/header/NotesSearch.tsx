import { SearchOutlined } from "@ant-design/icons";
import { Input, type InputRef } from "antd";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const NotesSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const [value, setValue] = useState(searchQuery);
  const timer = useRef<number>();
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    setValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commit = (next: string) => {
    const trimmed = next.trim();
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (trimmed) {
          params.set("search", trimmed);
        } else {
          params.delete("search");
        }
        return params;
      },
      { replace: true }
    );
  };

  return (
    <div className="notes-search">
      <Input
        ref={inputRef}
        style={{ width: "100%" }}
        allowClear
        prefix={<SearchOutlined />}
        suffix={<span className="search-kbd">⌘ K</span>}
        placeholder="Search notes..."
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => commit(next), 300);
        }}
        onPressEnter={() => {
          window.clearTimeout(timer.current);
          commit(value);
        }}
      />
    </div>
  );
};

export default NotesSearch;
