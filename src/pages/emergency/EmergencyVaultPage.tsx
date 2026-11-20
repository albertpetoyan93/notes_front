import { ArrowLeftOutlined, CopyOutlined, EyeInvisibleOutlined, EyeOutlined, LockOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Select, Spin, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetcherGet } from "../../configs/axios";
import useFieldClipboard from "../../hooks/useFieldClipboard";
import { useKeyStore } from "../../store/keyStore";
import dayjsExtra from "../../utils/dayjs";
import { categoryLabel } from "../../utils/noteCategory";
import { openEmergencyVault, waitingNotice, type Item, type VaultResponse } from "../../utils/emergencyVault";
import { displayValue, maskValue, noteBody, noteFields } from "../../utils/noteFields";
import { isSecretField } from "../../utils/secretField";
import "../company/CompanyPage.scss";
import "../settings/SecurityPage.scss";
import "./EmergencyPage.scss";

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
  const [waiting, setWaiting] = useState(0);
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
        const opened = await openEmergencyVault(Number(id), data, keys);
        if (cancelled) return;
        setOwner(data.owner);
        setGrantedAt(data.grantedAt);
        setWaiting(data.scheme === "emergency-key" ? data.waiting : 0);
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
          {owner && waitingNotice(waiting, owner.name) && (
            <Alert className="emergency-waiting" type="info" showIcon message={waitingNotice(waiting, owner.name)} />
          )}
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
