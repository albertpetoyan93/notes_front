import {
  AppstoreOutlined,
  BankOutlined,
  BgColorsOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Modal } from "antd";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ItemIcon from "../itemIcon/ItemIcon";
import { useTheme } from "../../contexts/ThemeContext";
import { useCompanyStore } from "../../store/companyStore";
import type { Note } from "../../store/noteStore";
import { useVaultStore } from "../../store/vaultStore";
import { CATEGORY_ORDER, categoryClass, categoryLabel } from "../../utils/noteCategory";
import { searchText } from "../../utils/noteFields";

interface Entry {
  key: string;
  group: "Items" | "Commands";
  label: string;
  hint: string;
  icon: ReactNode;
  run: () => void;
}

const MAX_ITEMS = 8;

// Search the open vault and run commands from one box. Arrow keys move, Enter runs, Esc closes.
const CommandPalette = ({
  open,
  onClose,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  companyId: number | null;
}) => {
  const navigate = useNavigate();
  const summary = useVaultStore((state) => state.summary);
  const companies = useCompanyStore((state) => state.companies);
  const { mode, handleThemeChange } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const base = companyId ? `/company/${companyId}` : "/notes";

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const to = (params: Record<string, string>, path = base) => () =>
      navigate(`${path}?${new URLSearchParams(params).toString()}`);

    const items: Entry[] = summary
      .filter((note: Note) => !q || searchText(note).includes(q))
      .slice(0, q ? MAX_ITEMS : 5)
      .map((note) => ({
        key: `item-${note.id}`,
        group: "Items",
        label: note.title,
        hint: categoryLabel(note.category),
        icon: <ItemIcon note={note} size="sm" />,
        run: to({ item: String(note.id) }),
      }));

    const commands: Entry[] = [
      ...CATEGORY_ORDER.map((category) => ({
        key: `new-${category}`,
        group: "Commands" as const,
        label: `New ${categoryLabel(category).toLowerCase()}`,
        hint: "Create",
        icon: <span className={`palette-dot ${categoryClass(category)}`}><PlusOutlined /></span>,
        run: to({ new: category }),
      })),
      { key: "go-all", group: "Commands", label: "All items", hint: "Go to", icon: <AppstoreOutlined />, run: to({}) },
      { key: "go-fav", group: "Commands", label: "Favorites", hint: "Go to", icon: <StarOutlined />, run: to({ favorites: "true" }) },
      ...(!companyId
        ? [
            { key: "go-shared", group: "Commands" as const, label: "Shared with me", hint: "Go to", icon: <UsergroupAddOutlined />, run: to({ shared: "true" }) },
            { key: "go-health", group: "Commands" as const, label: "Security health", hint: "Go to", icon: <SafetyCertificateOutlined />, run: to({ health: "1" }) },
            { key: "go-trash", group: "Commands" as const, label: "Trash", hint: "Go to", icon: <DeleteOutlined />, run: to({ trash: "true" }) },
          ]
        : []),
      ...(companyId
        ? [{ key: "vault-personal", group: "Commands" as const, label: "Switch to Personal vault", hint: "Vault", icon: <UserOutlined />, run: to({}, "/notes") }]
        : []),
      ...companies
        .filter((company) => company.memberStatus === "active" && company.id !== companyId)
        .map((company) => ({
          key: `vault-${company.id}`,
          group: "Commands" as const,
          label: `Switch to ${company.name}`,
          hint: "Vault",
          icon: <BankOutlined />,
          run: to({}, `/company/${company.id}`),
        })),
      {
        key: "theme",
        group: "Commands",
        label: mode === "light" ? "Switch to dark mode" : "Switch to light mode",
        hint: "Theme",
        icon: <BgColorsOutlined />,
        run: () => handleThemeChange(mode === "light" ? "dark" : "light"),
      },
    ];

    return [...items, ...commands.filter((entry) => !q || entry.label.toLowerCase().includes(q))];
  }, [query, summary, companies, companyId, base, mode, navigate, handleThemeChange]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (entry?: Entry) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(entries[active]);
    }
  };

  let lastGroup = "";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={600}
      style={{ top: "12vh" }}
      wrapClassName="palette-modal"
      destroyOnClose
      aria-label="Search and commands"
    >
      <div className="palette-input">
        <SearchOutlined />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search items, or type a command…"
          aria-label="Search items or commands"
          aria-controls="palette-results"
          aria-activedescendant={entries[active] ? `palette-${entries[active].key}` : undefined}
          role="combobox"
          aria-expanded
        />
        <kbd>Esc</kbd>
      </div>
      <div className="palette-results" id="palette-results" role="listbox" ref={listRef}>
        {entries.length === 0 && <div className="palette-empty">No matches for “{query}”.</div>}
        {entries.map((entry, index) => {
          const heading = entry.group !== lastGroup ? entry.group : null;
          lastGroup = entry.group;
          return (
            <div key={entry.key}>
              {heading && <div className="palette-group">{heading}</div>}
              <button
                type="button"
                id={`palette-${entry.key}`}
                role="option"
                aria-selected={index === active}
                data-index={index}
                className={index === active ? "palette-item is-active" : "palette-item"}
                onMouseMove={() => setActive(index)}
                onClick={() => run(entry)}
              >
                <span className="palette-icon">{entry.icon}</span>
                <span className="palette-label">{entry.label}</span>
                <span className="palette-hint">{entry.hint}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>Enter</kbd> to open
        </span>
        <span>
          <kbd>Esc</kbd> to close
        </span>
      </div>
    </Modal>
  );
};

export default CommandPalette;
