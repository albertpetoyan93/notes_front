import {
  AppstoreOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileAddOutlined,
  FolderOutlined,
  MoreOutlined,
  NumberOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  StarOutlined,
  TeamOutlined,
  UploadOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Dropdown, Modal, Tooltip, message } from "antd";
import { useRef, useState, type ReactNode } from "react";
import useVaultNav from "../../hooks/useVaultNav";
import CollectionDialogs from "../../pages/notes/CollectionDialogs";
import { useCompanyStore } from "../../store/companyStore";
import { CollectionItem, useNoteStore } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { CATEGORY_ORDER, categoryClass, categoryKey, categoryPlural } from "../../utils/noteCategory";
import { healthIssues } from "../../utils/noteFields";
import VaultSwitcher from "./VaultSwitcher";

const TAG_PREVIEW = 6;

const NavItem = ({
  active,
  icon,
  label,
  count,
  countTone,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  countTone?: "warn";
  onClick: () => void;
}) => (
  <button
    type="button"
    className={active ? "nav-item is-active" : "nav-item"}
    aria-current={active ? "page" : undefined}
    onClick={onClick}
  >
    <span className="nav-icon">{icon}</span>
    <span className="nav-label">{label}</span>
    {count !== undefined && count > 0 && (
      <span className={countTone ? `nav-count ${countTone}` : "nav-count"}>{count}</span>
    )}
  </button>
);

const Heading = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="nav-heading">
    <span>{children}</span>
    {action}
  </div>
);

const VaultSidebar = ({ companyId }: { companyId: number | null }) => {
  const nav = useVaultNav();
  const { summary, collections, refresh, bumpList } = useVaultStore();
  const { deleteCollection, exportNotes, importNotes } = useNoteStore();
  const company = useCompanyStore((state) =>
    state.companies.find((item) => item.id === companyId)
  );
  const canManage =
    !!company && company.memberStatus === "active" && (company.role === "owner" || company.role === "admin");
  const [dialog, setDialog] = useState<{
    mode: "create" | "rename" | "add" | "share";
    collection: CollectionItem | null;
  } | null>(null);
  const [allTags, setAllTags] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const noFilter = !nav.category && !nav.collection && !nav.tag && !nav.tab;
  const count = (test: (note: (typeof summary)[number]) => boolean) => summary.filter(test).length;

  const categories = CATEGORY_ORDER.map((key) => ({
    key,
    count: count((note) => categoryKey(note.category) === key),
  })).filter((item) => item.count > 0 || nav.category === item.key);

  const tags = Array.from(new Set(summary.flatMap((note) => note.tags || []))).sort((a, b) =>
    a.localeCompare(b)
  );
  const shownTags = allTags ? tags : tags.slice(0, TAG_PREVIEW);
  const flagged = count((note) => healthIssues(note).length > 0);

  const changed = () => {
    refresh();
    bumpList();
  };

  // Deleting a collection drops its sharing for good, so this one asks first.
  const removeCollection = (collection: CollectionItem) => {
    Modal.confirm({
      title: `Delete "${collection.name}"?`,
      content: "Notes in this collection stay in your list, without a collection.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteCollection(collection.id);
        if (nav.collection === String(collection.id)) nav.go();
        changed();
        message.success("Collection deleted");
      },
    });
  };

  const handleExport = async () => {
    try {
      const backup = await exportNotes();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      if (backup.skipped) {
        message.warning(
          `Exported ${backup.notes.length} notes. Skipped ${backup.skipped} that could not be decrypted.`
        );
      } else {
        message.success(`Exported ${backup.notes.length} notes`);
      }
    } catch (error: any) {
      message.error(error?.message || "Failed to export notes");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const notes = Array.isArray(parsed) ? parsed : parsed?.notes;
      if (!Array.isArray(notes) || notes.length === 0) {
        message.error("That file has no notes to import");
        return;
      }
      const result = await importNotes(notes);
      changed();
      if (result.failed?.length) {
        message.warning(`Imported ${result.imported}. ${result.failed.length} could not be imported.`);
      } else {
        message.success(`Imported ${result.imported} notes`);
      }
    } catch (error: any) {
      message.error(error?.message || "Failed to import notes");
    }
  };

  const collectionMenu = (collection: CollectionItem) => {
    const canEdit = collection.permission === "owner" || collection.permission === "edit";
    return [
      ...(canEdit
        ? [{ key: "add", icon: <FileAddOutlined />, label: "Add notes", onClick: () => setDialog({ mode: "add", collection }) }]
        : []),
      ...(collection.isOwner
        ? [
            { key: "share", icon: <ShareAltOutlined />, label: "Share", onClick: () => setDialog({ mode: "share", collection }) },
            { key: "rename", icon: <EditOutlined />, label: "Rename", onClick: () => setDialog({ mode: "rename", collection }) },
            { type: "divider" as const },
            {
              key: "delete",
              icon: <DeleteOutlined />,
              label: "Delete",
              danger: true,
              onClick: () => removeCollection(collection),
            },
          ]
        : []),
    ];
  };

  return (
    <div className="sidebar-inner">
      <VaultSwitcher companyId={companyId} />

      <nav className="side-nav" aria-label="Vault">
        <NavItem
          active={nav.view === "all" && noFilter}
          icon={<AppstoreOutlined />}
          label="All items"
          count={summary.length}
          onClick={() => nav.go()}
        />
        <NavItem
          active={nav.view === "favorites" && noFilter}
          icon={<StarOutlined />}
          label="Favorites"
          count={count((note) => note.isFavorite)}
          onClick={() => nav.go({ favorites: "true" })}
        />
        {!companyId && (
          <NavItem
            active={nav.view === "shared" && noFilter}
            icon={<UsergroupAddOutlined />}
            label="Shared with me"
            count={count((note) => !!note.isShared)}
            onClick={() => nav.go({ shared: "true" })}
          />
        )}

        {categories.length > 0 && <Heading>Categories</Heading>}
        {categories.map((item) => (
          <NavItem
            key={item.key}
            active={nav.category === item.key && nav.view === "all"}
            icon={<span className={`nav-dot ${categoryClass(item.key)}`} />}
            label={categoryPlural(item.key)}
            count={item.count}
            onClick={() => nav.go({ category: item.key })}
          />
        ))}

        <Heading
          action={
            !companyId ? (
              <Tooltip title="New collection">
                <button
                  type="button"
                  className="nav-heading-action"
                  aria-label="New collection"
                  onClick={() => setDialog({ mode: "create", collection: null })}
                >
                  <PlusOutlined />
                </button>
              </Tooltip>
            ) : undefined
          }
        >
          Collections
        </Heading>
        {collections.length === 0 && (
          <p className="nav-empty">
            {companyId ? "Nothing shared with you yet." : "Group items, then share a whole collection."}
          </p>
        )}
        {collections.map((collection) => {
          const menu = companyId ? [] : collectionMenu(collection);
          return (
            <div key={collection.id} className="nav-row">
              <NavItem
                active={nav.collection === String(collection.id)}
                icon={collection.isOwner || companyId ? <FolderOutlined /> : <TeamOutlined />}
                label={collection.name}
                count={collection.noteCount}
                onClick={() => nav.go({ collection: String(collection.id) })}
              />
              {menu.length > 0 && (
                <Dropdown trigger={["click"]} menu={{ items: menu }} placement="bottomRight">
                  <button type="button" className="nav-row-more" aria-label={`${collection.name} options`}>
                    <MoreOutlined />
                  </button>
                </Dropdown>
              )}
            </div>
          );
        })}

        {tags.length > 0 && <Heading>Tags</Heading>}
        {shownTags.map((tag) => (
          <NavItem
            key={tag}
            active={nav.tag === tag}
            icon={<NumberOutlined />}
            label={tag}
            onClick={() => nav.go({ tag })}
          />
        ))}
        {tags.length > TAG_PREVIEW && (
          <button type="button" className="nav-more" onClick={() => setAllTags((value) => !value)}>
            {allTags ? "Show fewer" : `Show all ${tags.length}`}
          </button>
        )}

        {canManage && (
          <>
            <Heading>Team</Heading>
            <NavItem
              active={nav.tab === "collections"}
              icon={<FolderOutlined />}
              label="Manage collections"
              onClick={() => nav.go({ tab: "collections" })}
            />
            <NavItem
              active={nav.tab === "members"}
              icon={<TeamOutlined />}
              label="Members"
              onClick={() => nav.go({ tab: "members" })}
            />
            <NavItem
              active={nav.tab === "settings"}
              icon={<SettingOutlined />}
              label="Settings"
              onClick={() => nav.go({ tab: "settings" })}
            />
          </>
        )}

        {!companyId && (
          <>
            <Heading>Vault</Heading>
            <NavItem
              active={nav.view === "health"}
              icon={<SafetyCertificateOutlined />}
              label="Security health"
              count={flagged}
              countTone="warn"
              onClick={() => nav.go({ health: "1" })}
            />
            <NavItem
              active={nav.view === "trash"}
              icon={<DeleteOutlined />}
              label="Trash"
              onClick={() => nav.go({ trash: "true" })}
            />
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) handleImport(file);
              }}
            />
            <Dropdown
              trigger={["click"]}
              placement="topLeft"
              overlayClassName="backup-dropdown"
              menu={{
                items: [
                  {
                    key: "export",
                    label: (
                      <span className="backup-option">
                        <span className="backup-icon export">
                          <DownloadOutlined />
                        </span>
                        <span className="backup-copy">
                          <strong>Export notes</strong>
                          <small>Download your vault as a .json backup</small>
                        </span>
                      </span>
                    ),
                    onClick: handleExport,
                  },
                  {
                    key: "import",
                    label: (
                      <span className="backup-option">
                        <span className="backup-icon import">
                          <UploadOutlined />
                        </span>
                        <span className="backup-copy">
                          <strong>Import notes</strong>
                          <small>Add notes from a 2keevo .json file</small>
                        </span>
                      </span>
                    ),
                    onClick: () => importRef.current?.click(),
                  },
                ],
              }}
            >
              <button type="button" className="nav-item">
                <span className="nav-icon">
                  <CloudSyncOutlined />
                </span>
                <span className="nav-label">Backup</span>
              </button>
            </Dropdown>
          </>
        )}
      </nav>

      <CollectionDialogs
        mode={dialog?.mode || null}
        collection={dialog?.collection}
        onClose={() => setDialog(null)}
        onChanged={changed}
      />
    </div>
  );
};

export default VaultSidebar;
