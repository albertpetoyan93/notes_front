import {
  FolderOutlined,
  SettingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useLocation, useSearchParams } from "react-router-dom";
import { useCompanyStore } from "../../store/companyStore";

const tabs = [
  { key: "notes", label: "Notes", icon: <UnorderedListOutlined /> },
  { key: "collections", label: "Collections", icon: <FolderOutlined /> },
  { key: "members", label: "Members", icon: <TeamOutlined /> },
  { key: "settings", label: "Settings", icon: <SettingOutlined /> },
];

const CompanyTabs = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const companies = useCompanyStore((state) => state.companies);
  const companyId = location.pathname.startsWith("/company/")
    ? location.pathname.split("/")[2]
    : "";
  const company = companies.find((item) => String(item.id) === companyId);
  const canManage =
    company?.memberStatus === "active" &&
    (company.role === "owner" || company.role === "admin");

  if (!canManage) return null;

  const current = searchParams.get("tab") || "notes";

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

export default CompanyTabs;
