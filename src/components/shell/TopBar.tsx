import { MenuOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip } from "antd";
import { Link } from "react-router-dom";
import { BrandLockup } from "../header/LeftHeader";
import RightHeader from "../header/RightHeader";
import useVaultNav from "../../hooks/useVaultNav";
import { useVaultStore } from "../../store/vaultStore";
import { CATEGORY_ORDER, categoryClass, categoryLabel } from "../../utils/noteCategory";

const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";

const NewItemButton = ({ companyId }: { companyId: number | null }) => {
  const nav = useVaultNav();
  const collections = useVaultStore((state) => state.collections);
  // In a company every note lives in a collection, so you need one you can edit.
  const blocked =
    !!companyId &&
    !collections.some((item) => item.permission === "owner" || item.permission === "edit");

  const button = (
    <Button type="primary" icon={<PlusOutlined />} disabled={blocked} aria-label="New item">
      <span className="topbar-new-label">New item</span>
    </Button>
  );

  if (blocked) {
    return <Tooltip title="Ask an admin to share a collection you can edit">{button}</Tooltip>;
  }

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      overlayClassName="new-item-menu"
      menu={{
        items: CATEGORY_ORDER.map((category) => ({
          key: category,
          label: categoryLabel(category),
          icon: <span className={`nav-dot ${categoryClass(category)}`} />,
          // Keep the open collection so the new item lands in it.
          onClick: () => nav.go({ new: category, collection: nav.collection || null }),
        })),
      }}
    >
      {button}
    </Dropdown>
  );
};

const TopBar = ({
  companyId,
  onMenu,
  onSearch,
}: {
  companyId: number | null;
  onMenu: () => void;
  onSearch: () => void;
}) => (
  <header className="topbar">
    <button type="button" className="icon-btn phone-only" aria-label="Open navigation" onClick={onMenu}>
      <MenuOutlined />
    </button>
    <Link to="/notes" className="topbar-brand" aria-label="2keevo, personal vault">
      <BrandLockup />
    </Link>
    <button type="button" className="topbar-search" onClick={onSearch} aria-keyshortcuts="Control+K Meta+K">
      <SearchOutlined />
      <span className="topbar-search-text">Search the vault or run a command…</span>
      <kbd>{shortcut}</kbd>
    </button>
    <div className="topbar-right">
      <NewItemButton companyId={companyId} />
      <RightHeader />
    </div>
  </header>
);

export default TopBar;
