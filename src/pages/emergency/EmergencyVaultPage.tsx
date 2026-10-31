import { ArrowLeftOutlined, CopyOutlined, EyeInvisibleOutlined, EyeOutlined, LockOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Select, Spin, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetcherGet } from "../../configs/axios";
import { openBundleWithUserKey, type KeyBundle } from "../../crypto/account";
import { openOwnerUserKey } from "../../crypto/emergency";
import { openCollectionKey, openCollectionName, openItemData, openItemKey } from "../../crypto/items";
import useFieldClipboard from "../../hooks/useFieldClipboard";
import { useKeyStore } from "../../store/keyStore";
import dayjsExtra from "../../utils/dayjs";
import { categoryLabel } from "../../utils/noteCategory";
import { displayValue, maskValue, noteBody, noteFields, type NoteField } from "../../utils/noteFields";
import { isSecretField } from "../../utils/secretField";
import "../company/CompanyPage.scss";
import "../settings/SecurityPage.scss";
import "./EmergencyPage.scss";

interface RawItem {
  e2e?: boolean;
  e2eId?: string;
  itemKey?: string;
  encData?: string;
  title?: string;
  content?: unknown;
  category: string;
  tags?: string[];
  collectionIds?: number[];
}

interface RawCollection {
  id: number;
  name: string | null;
  encName: string | null;
  nameKey: string | null;
  keyVersion: number | null;
  collectionKey: string | null;
}

interface VaultResponse {
  owner: { id: number; name: string; email: string };
  grantedAt: string | null;
  sealedUserKey: string;
  publicKey: string | null;
  protectedPrivateKey: string | null;
  collections: RawCollection[];
  items: RawItem[];
}

interface Item {
  key: string;
  title: string;
  category: string;
  content: { mainContent?: string; customFields?: NoteField[] } | string;
  tags: string[];
  collectionIds: number[];
  failed: boolean;
}

/** Opens the owner's vault in this browser with the key they sealed to this contact. */
const openVault = async (id: number, data: VaultResponse, mine: { privateKey: Uint8Array; publicKey: string }) => {
  const userKey = await openOwnerUserKey(mine.privateKey, mine.publicKey, id, data.sealedUserKey);

  // The owner's private key opens collection keys, for names sealed with one.
  let ownerKeys: { privateKey: Uint8Array; publicKey: string } | null = null;
  if (data.protectedPrivateKey && data.publicKey) {
    ownerKeys = await openBundleWithUserKey(userKey, {
      protectedPrivateKey: data.protectedPrivateKey,
      publicKey: data.publicKey,
    } as KeyBundle).catch(() => null);
  }

  const names = new Map<number, string>();
  for (const collection of data.collections) {
    try {
      if (!collection.encName) {
        names.set(collection.id, collection.name || "Collection");
      } else if (collection.nameKey === "user") {
        names.set(collection.id, await openCollectionName(userKey, collection.id, "user", collection.encName));
      } else if (ownerKeys && collection.collectionKey && collection.keyVersion && collection.nameKey) {
        const key = await openCollectionKey(
          ownerKeys.privateKey,
          ownerKeys.publicKey,
          collection.id,
          collection.keyVersion,
          collection.collectionKey
        );
        names.set(collection.id, await openCollectionName(key, collection.id, collection.nameKey, collection.encName));
      } else {
        names.set(collection.id, "A collection");
      }
    } catch {
      names.set(collection.id, "A collection");
    }
  }

  const items: Item[] = await Promise.all(
    data.items.map(async (raw, index) => {
      const base = { key: String(index), category: raw.category, collectionIds: raw.collectionIds || [] };
      if (!raw.e2e) {
        return {
          ...base,
          title: raw.title || "Untitled",
          content: (raw.content as Item["content"]) ?? "",
          tags: raw.tags || [],
          failed: false,
        };
      }
      try {
        const key = await openItemKey(userKey, String(raw.e2eId), String(raw.itemKey));
        const payload = await openItemData(key, String(raw.e2eId), String(raw.encData));
        return {
          ...base,
          title: payload.title || "Untitled",
          content: payload.content as Item["content"],
          tags: payload.tags || [],
          failed: false,
        };
      } catch {
        return { ...base, title: "Item can't be opened", content: "", tags: [], failed: true };
      }
    })
  );
  items.sort((a, b) => a.title.localeCompare(b.title));
  return { names, items };
};

const ItemView = ({ item }: { item: Item }) => {
  const clipboard = useFieldClipboard();
  const fields = noteFields({ content: item.content as any }).filter((field) => field.value.trim());
  const body = noteBody({ content: item.content as any });

  return (
    <div className="emergency-item">
      <div className="emergency-item-head">
        <h2>{item.title}</h2>
        <Tag>{categoryLabel(item.category)}</Tag>
      </div>
      {fields.length > 0 && (
        <dl className="emergency-fields">
          {fields.map((field, index) => {
            const key = `${item.key}:${index}`;
            const secret = isSecretField(field.label);
            const shown = displayValue(field, fields);
            return (
              <div key={key} className="emergency-field">
                <dt>{field.label}</dt>
                <dd>
                  <span className={secret ? "mono" : undefined}>
                    {secret && !clipboard.isVisible(key) ? maskValue(field, shown) : shown}
                  </span>
                  {secret && (
                    <Tooltip title={clipboard.isVisible(key) ? "Hide" : "Show"}>
                      <Button
                        type="text"
                        size="small"
                        aria-label={clipboard.isVisible(key) ? "Hide" : "Show"}
                        icon={clipboard.isVisible(key) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => clipboard.toggleVisible(key)}
                      />
                    </Tooltip>
                  )}
                  <Tooltip title="Copy">
                    <Button
                      type="text"
                      size="small"
                      aria-label={`Copy ${field.label}`}
                      icon={<CopyOutlined />}
                      onClick={() => clipboard.copy(field.value, key, field.label, secret)}
                    />
                  </Tooltip>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {body.trim() && <pre className="emergency-body">{body}</pre>}
      {item.tags.length > 0 && (
        <div className="emergency-tags">
          {item.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
    </div>
  );
};

// Someone's personal vault, opened with emergency access: read-only.
const EmergencyVaultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const keys = useKeyStore((state) => state.keys);
  const [owner, setOwner] = useState<VaultResponse["owner"] | null>(null);
  const [grantedAt, setGrantedAt] = useState<string | null>(null);
  const [vault, setVault] = useState<{ names: Map<number, string>; items: Item[] } | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState<number | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVault(null);
    setError("");
    if (!keys) {
      setError("Your vault is locked, or end-to-end encryption is off. Unlock it to open this vault.");
      return;
    }
    (async () => {
      try {
        const data: VaultResponse = await fetcherGet(`/api/emergency/${id}/vault`);
        const opened = await openVault(Number(id), data, keys);
        if (cancelled) return;
        setOwner(data.owner);
        setGrantedAt(data.grantedAt);
        setVault(opened);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "This vault can't be opened.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, keys]);

  const visible = useMemo(() => {
    if (!vault) return [];
    const query = search.trim().toLowerCase();
    return vault.items.filter(
      (item) =>
        (collection === "all" || item.collectionIds.includes(collection)) &&
        (!query ||
          item.title.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          noteFields({ content: item.content as any }).some(
            (field) => !isSecretField(field.label) && field.value.toLowerCase().includes(query)
          ))
    );
  }, [vault, search, collection]);

  const current = visible.find((item) => item.key === selected) || null;

  return (
    <div className="manage-page security-page emergency-page emergency-vault">
      <Button type="link" className="emergency-back" icon={<ArrowLeftOutlined />} onClick={() => navigate("/emergency")}>
        Emergency access
      </Button>
      <div className="manage-head">
        <div>
          <h1>{owner ? `${owner.name}'s vault` : "Vault"}</h1>
          <p>
            <LockOutlined /> Read-only, with emergency access{grantedAt ? ` since ${dayjsExtra(grantedAt).format("D MMM YYYY")}` : ""}.
            {owner ? ` ${owner.name} can see what you open in their activity.` : ""}
          </p>
        </div>
      </div>

      {error ? (
        <Alert type="error" showIcon message={error} />
      ) : !vault ? (
        <div className="security-loading">
          <Spin />
        </div>
      ) : (
        <>
          <div className="emergency-filters">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              aria-label="Collection"
              value={collection}
              onChange={setCollection}
              popupMatchSelectWidth={false}
              options={[
                { value: "all" as const, label: `All items (${vault.items.length})` },
                ...[...vault.names.entries()].map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <div className="manage-card">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No items." />
            </div>
          ) : (
            <div className="emergency-browser">
              <ul className="manage-list emergency-items">
                {visible.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`emergency-item-row${item.key === current?.key ? " is-selected" : ""}`}
                      onClick={() => setSelected(item.key)}
                    >
                      <strong>{item.title}</strong>
                      <span>
                        {categoryLabel(item.category)}
                        {item.collectionIds.length
                          ? ` · ${item.collectionIds.map((cid) => vault.names.get(cid) || "A collection").join(", ")}`
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="emergency-detail">
                {current ? (
                  current.failed ? (
                    <Alert type="warning" showIcon message="This item can't be opened." />
                  ) : (
                    <ItemView key={current.key} item={current} />
                  )
                ) : (
                  <p className="security-section-note">Choose an item to see it.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmergencyVaultPage;
