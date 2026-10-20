import { CrownOutlined, FolderOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Spin, Tag, message } from "antd";
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

const permissionLabel = (permission: "view" | "edit") =>
  permission === "edit" ? "Can edit" : "Can view";

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
          await fetcherDelete(
            `/api/collections/${route.collectionId}/share/${person.userId}`
          );
          message.success("Access revoked");
          await load();
          onChanged();
        } catch (err: any) {
          message.error(err?.message || "Only the collection's owner can change its sharing");
        }
      },
    });

  if (error) return <p className="access-error">{error}</p>;
  if (!access) {
    return (
      <div className="access-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="access-panel">
      <div className="access-summary">
        <TeamOutlined />
        <span>
          {access.count === 0
            ? "Only the owner can open this item."
            : `${access.count} ${access.count === 1 ? "person" : "people"} besides the owner can open this item.`}
        </span>
      </div>

      {isOwner && !access.companyId && (
        <Button block icon={<UserAddOutlined />} onClick={onAddPeople}>
          Share with more people
        </Button>
      )}

      <ul className="access-list">
        {access.owner && (
          <li className="access-person">
            <span className="access-avatar is-owner">
              <CrownOutlined />
            </span>
            <div className="access-main">
              <strong>{access.owner.name}</strong>
              <span>{access.owner.email}</span>
            </div>
            <Tag>Owner</Tag>
          </li>
        )}
        {access.people.map((person) => {
          const canEdit = person.routes.some((route) => route.permission === "edit");
          return (
            <li key={person.userId} className="access-person">
              <span className="access-avatar">{person.name.charAt(0).toUpperCase()}</span>
              <div className="access-main">
                <strong>{person.name}</strong>
                <span>{person.email}</span>
                <ul className="access-routes">
                  {person.routes.map((route, index) => (
                    <li key={index}>
                      {route.type === "direct" ? null : <FolderOutlined />}
                      <span>{routeText(route)}</span>
                      {route.type === "direct" && isOwner && (
                        <Button
                          size="small"
                          type="link"
                          danger
                          onClick={() => revokeDirect(person)}
                        >
                          Revoke
                        </Button>
                      )}
                      {route.type === "collection" && !route.collectionOwner && isOwner && (
                        <Button
                          size="small"
                          type="link"
                          danger
                          onClick={() => revokeCollection(person, route)}
                        >
                          Remove from collection
                        </Button>
                      )}
                      {route.type === "company" && access.companyId && (
                        <Button
                          size="small"
                          type="link"
                          onClick={() =>
                            navigate(`/company/${access.companyId}?tab=collections`)
                          }
                        >
                          Manage
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <Tag color={canEdit ? "purple" : undefined}>
                {permissionLabel(canEdit ? "edit" : "view")}
              </Tag>
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
