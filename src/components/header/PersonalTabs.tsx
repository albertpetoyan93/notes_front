import { FolderOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useLocation, useSearchParams } from "react-router-dom";

const tabs = [
  { key: "notes", label: "Notes", icon: <UnorderedListOutlined /> },
  { key: "collections", label: "Collections", icon: <FolderOutlined /> },
];

const PersonalTabs = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const personal =
    location.pathname === "/" || location.pathname === "/notes";

  if (!personal) return null;

  const current =
    searchParams.get("tab") === "collections" ? "collections" : "notes";

  const openTab = (key: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === "notes") next.delete("tab");
        else next.set("tab", key);
        return next;
      },
      { replace: true }
    );
  };

  return (
    <div className="company-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={current === tab.key ? "company-tab active" : "company-tab"}
          onClick={() => openTab(tab.key)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default PersonalTabs;
