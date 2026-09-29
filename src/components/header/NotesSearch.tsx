import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const NotesSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const [value, setValue] = useState(searchQuery);
  const timer = useRef<number>();

  useEffect(() => {
    setValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
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
        style={{ width: "100%" }}
        allowClear
        prefix={<SearchOutlined />}
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
