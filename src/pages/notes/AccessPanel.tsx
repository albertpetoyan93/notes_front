import {
  BankOutlined,
  CloseOutlined,
  CrownOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOutlined,
  LinkOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { Button, Empty, Modal, Spin, Tooltip, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetcherDelete, fetcherGet } from "../../configs/axios";
import dayjsExtra from "../../utils/dayjs";

type Route =
  | { type: "direct"; permission: "view" | "edit"; expiresAt: string | null }
  | {
      type: "collection";
      collectionId: number;
      collectionName: string;
      permission: "view" | "edit";
      expiresAt: string | null;
      collectionOwner?: boolean;
    }
  | {
      type: "company";
      collectionId: number;
      collectionName: string;
      permission: "view" | "edit";
      role: "owner" | "admin" | "member";
      everyone: boolean;
    };

interface Person {
  userId: number;
  name: string;
  email: string;
  routes: Route[];
}

interface AccessList {
  owner: { userId: number; name: string; email: string } | null;
  people: Person[];
  count: number;
  companyId: number | null;
}

const expiry = (expiresAt: string | null) =>
  expiresAt ? ` · until ${dayjsExtra(expiresAt).format("D MMM YYYY")}` : "";

const routeText = (route: Route) => {
  switch (route.type) {
    case "direct":
      return `Shared with them directly${expiry(route.expiresAt)}`;
    case "collection":
      return route.collectionOwner
        ? `Added to their collection "${route.collectionName}"`
        : `Through the shared collection "${route.collectionName}"${expiry(route.expiresAt)}`;
    case "company":
      if (route.role !== "member") {
        return `Company ${route.role}: sees every collection, including "${route.collectionName}"`;
      }
      return route.everyone
        ? `"${route.collectionName}" is shared with everyone in the company`
        : `"${route.collectionName}" is shared with them`;
  }
};

interface ChipAction {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

const shortDate = (value: string | null) => (value ? dayjsExtra(value).format("D MMM") : null);

// One way a person gets in, as a small chip; its action is an icon on the chip.
const RouteChip = ({ route, action }: { route: Route; action: ChipAction | null }) => {
  const until = route.type !== "company" ? shortDate(route.expiresAt) : null;
  const icon =
    route.type === "direct" ? (
      <LinkOutlined />
    ) : route.type === "company" ? (
      <BankOutlined />
    ) : (
      <FolderOutlined />
    );
  const label =
    route.type === "direct"
      ? "Direct"
      : route.type === "collection"
        ? route.collectionName
        : route.role !== "member"
          ? `Company ${route.role}`
          : route.everyone
            ? `${route.collectionName} · everyone`
            : route.collectionName;

  return (
    <span className={`access-chip is-${route.type}`}>
      <Tooltip title={routeText(route)}>
        <span className="access-chip-text">
          {icon}
          <span className="access-chip-label">{label}</span>
          {until && <span className="access-chip-until">until {until}</span>}
        </span>
      </Tooltip>
      {action && (
        <Tooltip title={action.label}>
          <button
            type="button"
            className={`access-chip-action${action.danger ? " is-danger" : ""}`}
            aria-label={action.label}
            onClick={action.onClick}
          >
            {action.danger ? <CloseOutlined /> : <SettingOutlined />}
          </button>
        </Tooltip>
      )}
    </span>
  );
};

// Everyone who can open an item, how they got access, and a way to take it away.
const AccessPanel = ({
  noteId,
  isOwner,
  onAddPeople,
  onChanged,
}: {
  noteId: number;
  isOwner: boolean;
  onAddPeople: () => void;
  onChanged: () => void;
}) => {
  const navigate = useNavigate();
  const [access, setAccess] = useState<AccessList | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setAccess(await fetcherGet(`/api/notes/${noteId}/access`));
      setError("");
    } catch (err: any) {
      setError(err?.message || "Could not load who has access");
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  const revokeDirect = (person: Person) =>
    Modal.confirm({
      title: `Stop sharing with ${person.name}?`,
      content: "They lose this item at once. You can share it with them again later.",
      okText: "Revoke",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherDelete(`/api/notes/${noteId}/share/${person.userId}`);
          message.success("Access revoked");
          await load();
          onChanged();
        } catch (err: any) {
          message.error(err?.message || "Could not revoke access");
        }
      },
    });

  const revokeCollection = (person: Person, route: Extract<Route, { type: "collection" }>) =>
    Modal.confirm({
      title: `Remove ${person.name} from "${route.collectionName}"?`,
      content: `They lose every item in "${route.collectionName}", not only this one.`,
      okText: "Remove from collection",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherDelete(`/api/collections/${route.collectionId}/share/${person.userId}`);
          message.success("Access revoked");
          await load();
          onChanged();
        } catch (err: any) {
          message.error(err?.message || "Only the collection's owner can change its sharing");
        }
      },
    });

  const routeAction = (person: Person, route: Route): ChipAction | null => {
    if (route.type === "direct" && isOwner) {
      return {
        label: `Stop sharing with ${person.name}`,
        danger: true,
        onClick: () => revokeDirect(person),
      };
    }
    if (route.type === "collection" && !route.collectionOwner && isOwner) {
      return {
        label: `Remove ${person.name} from "${route.collectionName}"`,
        danger: true,
        onClick: () => revokeCollection(person, route),
      };
    }
    if (route.type === "company" && access?.companyId) {
      return {
        label: "Manage in company settings",
        onClick: () => navigate(`/company/${access.companyId}?tab=collections`),
      };
    }
    return null;
  };

  if (error) return <p className="access-error">{error}</p>;
  if (!access) {
    return (
      <div className="access-loading">
        <Spin />
      </div>
    );
  }

  const ownerPerson = access.owner;

  return (
    <div className="access-panel">
      <div className="access-summary">
        <span className="access-summary-text">
          <TeamOutlined />
          {access.count === 0
            ? "Only the owner"
            : `${access.count} ${access.count === 1 ? "person" : "people"} besides the owner`}
        </span>
        {isOwner && !access.companyId && (
          <Button size="small" type="primary" icon={<UserAddOutlined />} onClick={onAddPeople}>
            Add
          </Button>
        )}
      </div>

      <ul className="access-list">
        {ownerPerson && (
          <li className="access-person">
            <span className="access-avatar is-owner">
              <CrownOutlined />
            </span>
            <div className="access-main">
              <div className="access-name">
                <strong>{ownerPerson.name}</strong>
                <span className="access-pill is-owner">Owner</span>
              </div>
              <span className="access-email">{ownerPerson.email}</span>
            </div>
          </li>
        )}
        {access.people.map((person) => {
          const canEdit = person.routes.some((route) => route.permission === "edit");
          return (
            <li key={person.userId} className="access-person">
              <span className="access-avatar">{person.name.charAt(0).toUpperCase()}</span>
              <div className="access-main">
                <div className="access-name">
                  <strong>{person.name}</strong>
                  <span className={`access-pill${canEdit ? " is-edit" : ""}`}>
                    {canEdit ? <EditOutlined /> : <EyeOutlined />}
                    {canEdit ? "Can edit" : "Can view"}
                  </span>
                </div>
                <span className="access-email">{person.email}</span>
                <div className="access-routes">
                  {person.routes.map((route, index) => (
                    <RouteChip key={index} route={route} action={routeAction(person, route)} />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {access.people.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not shared with anyone" />
      )}
    </div>
  );
};

export default AccessPanel;
