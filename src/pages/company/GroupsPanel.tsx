import { ApartmentOutlined, CheckOutlined, CloseOutlined, MoreOutlined, PlusOutlined, UserAddOutlined } from "@ant-design/icons";
import { Button, Dropdown, Empty, Input, Modal, Select, Spin, Tag, Tooltip, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import axios from "../../configs/axios";
import { runKeyTasks } from "../../utils/vaultItems";
import type { CompanyCollection } from "./CompanyPage";

interface Person {
  userId: number;
  email: string;
  name: string;
}

interface ManagedGroup {
  id: number;
  name: string;
  members: Person[];
  collections: { collectionId: number; permission: "view" | "edit" }[];
  requests: (Person & { id: number; note: string | null; createdAt: string })[];
}

interface DirectoryGroup {
  id: number;
  name: string;
  members: number;
  isMember: boolean;
  requested: boolean;
}

type Groups = { manager: true; groups: ManagedGroup[] } | { manager: false; groups: DirectoryGroup[] };

interface MemberRow {
  userId?: number | null;
  email: string;
  status: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Company groups. Owners and admins make groups, add members and share collections with
 * them; members see the groups and ask to join one. Access changes need the collection
 * key handed over or replaced, which this browser does right after (runKeyTasks).
 */
const GroupsPanel = ({
  companyId,
  companyName,
  members,
  collections,
  onChanged,
}: {
  companyId: number;
  companyName: string;
  members: MemberRow[];
  collections: CompanyCollection[];
  onChanged: () => Promise<void> | void;
}) => {
  const [data, setData] = useState<Groups | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState<Record<number, number[]>>({});
  const [sharing, setSharing] = useState<Record<number, { collectionId?: number; permission: "view" | "edit" }>>({});
  const [asking, setAsking] = useState<DirectoryGroup | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setData((await axios.get(`/api/companies/${companyId}/groups`)).data);
    } catch (error: any) {
      message.error(error?.message || "Could not load groups");
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Run a change; access changes then hand over or replace keys in this browser. */
  const act = async (key: string, action: () => Promise<unknown>, done: string, keys = false) => {
    setBusy(key);
    try {
      await action();
      if (keys) await runKeyTasks().catch(() => undefined);
      message.success(done);
      await load();
      await onChanged();
      return true;
    } catch (error: any) {
      message.error(error?.message || "Something went wrong");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const collectionLabel = (id: number) => collections.find((item) => item.id === id)?.name || "A collection";

  const create = async () => {
    const ok = await act("create", () => axios.post(`/api/companies/${companyId}/groups`, { name }), "Group created");
    if (ok) {
      setName("");
      setCreating(false);
    }
  };

  const rename = (group: ManagedGroup) => {
    let next = group.name;
    Modal.confirm({
      title: "Rename group",
      icon: null,
      content: <Input defaultValue={group.name} maxLength={80} onChange={(event) => (next = event.target.value)} />,
      okText: "Save",
      onOk: () => act(`rename-${group.id}`, () => axios.put(`/api/companies/${companyId}/groups/${group.id}`, { name: next }), "Group renamed"),
    });
  };

  const remove = (group: ManagedGroup) =>
    Modal.confirm({
      title: `Delete ${group.name}?`,
      content: "Its members lose the collections they could open only through this group. Nobody leaves the company.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => act(`delete-${group.id}`, () => axios.delete(`/api/companies/${companyId}/groups/${group.id}`), "Group deleted", true),
    });

  if (!data) {
    return (
      <div className="manage-empty">
        <Spin />
      </div>
    );
  }

  if (!data.manager) {
    return (
      <>
        <div className="manage-head">
          <div>
            <h1 className="display-font">Groups</h1>
            <p>
              Groups in {companyName} share collections with their members. Ask to join one and an owner or admin
              decides.
            </p>
          </div>
        </div>
        {data.groups.length === 0 ? (
          <div className="manage-empty">No groups yet.</div>
        ) : (
          <ul className="manage-list">
            {data.groups.map((group) => (
              <li key={group.id} className="manage-row">
                <span className="manage-icon">
                  <ApartmentOutlined />
                </span>
                <div className="manage-main">
                  <strong>
                    {group.name} {group.isMember && <Tag color="green">You're in it</Tag>}
                  </strong>
                  <span>{plural(group.members, "member")}</span>
                </div>
                <div className="manage-actions">
                  {!group.isMember &&
                    (group.requested ? (
                      <>
                        <Tag>Asked to join</Tag>
                        <Button
                          size="small"
                          loading={busy === `cancel-${group.id}`}
                          onClick={() =>
                            act(`cancel-${group.id}`, () => axios.delete(`/api/companies/${companyId}/groups/${group.id}/request`), "Request cancelled")
                          }
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => {
                          setNote("");
                          setAsking(group);
                        }}
                      >
                        Ask to join
                      </Button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Modal
          title={asking ? `Ask to join ${asking.name}` : "Ask to join"}
          open={!!asking}
          okText="Send request"
          confirmLoading={!!asking && busy === `ask-${asking.id}`}
          onCancel={() => setAsking(null)}
          onOk={async () => {
            if (!asking) return;
            const ok = await act(
              `ask-${asking.id}`,
              () => axios.post(`/api/companies/${companyId}/groups/${asking.id}/request`, { note }),
              "Request sent. The company's owners and admins were told."
            );
            if (ok) setAsking(null);
          }}
          destroyOnClose
        >
          <Input.TextArea
            autoFocus
            maxLength={500}
            rows={3}
            placeholder="Why you need it (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Modal>
      </>
    );
  }

  const active = members.filter((member) => member.status === "active" && member.userId);
  const openRequests = data.groups.reduce((sum, group) => sum + group.requests.length, 0);

  return (
    <>
      <div className="manage-head">
        <div>
          <h1 className="display-font">Groups</h1>
          <p>
            Share collections with a group instead of person by person. People added to a group get its collections;
            people taken out lose them.
            {openRequests ? ` ${plural(openRequests, "request")} waiting.` : ""}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          New group
        </Button>
      </div>

      {data.groups.length === 0 ? (
        <div className="manage-card">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No groups yet. Make one, such as Engineering or Finance." />
        </div>
      ) : (
        <div className="groups-list">
          {data.groups.map((group) => {
            const inGroup = new Set(group.members.map((person) => person.userId));
            const candidates = active.filter((member) => !inGroup.has(member.userId as number));
            const shared = new Set(group.collections.map((item) => item.collectionId));
            const shareable = collections.filter((item) => !shared.has(item.id));
            const share = sharing[group.id] || { permission: "view" as const };
            return (
              <section key={group.id} className="manage-card group-card">
                <div className="group-card-head">
                  <span className="manage-icon">
                    <ApartmentOutlined />
                  </span>
                  <div className="manage-main">
                    <strong>{group.name}</strong>
                    <span>
                      {plural(group.members.length, "member")} · {plural(group.collections.length, "collection")}
                    </span>
                  </div>
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        { key: "rename", label: "Rename", onClick: () => rename(group) },
                        { key: "delete", label: "Delete", danger: true, onClick: () => remove(group) },
                      ],
                    }}
                  >
                    <Button type="text" className="icon-btn" icon={<MoreOutlined />} aria-label={`${group.name} options`} />
                  </Dropdown>
                </div>

                {group.requests.length > 0 && (
                  <div className="group-block">
                    <h3>Asking to join</h3>
                    {group.requests.map((request) => (
                      <div key={request.id} className="group-line">
                        <div className="group-line-text">
                          <span>{request.name || request.email}</span>
                          {request.note && <small>{request.note}</small>}
                        </div>
                        <Button
                          size="small"
                          icon={<CloseOutlined />}
                          loading={busy === `decline-${request.id}`}
                          onClick={() =>
                            act(`decline-${request.id}`, () => axios.post(`/api/companies/${companyId}/group-requests/${request.id}/decline`, {}), "Declined")
                          }
                        >
                          Decline
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckOutlined />}
                          loading={busy === `approve-${request.id}`}
                          onClick={() =>
                            act(
                              `approve-${request.id}`,
                              () => axios.post(`/api/companies/${companyId}/group-requests/${request.id}/approve`, {}),
                              `${request.name || request.email} joined ${group.name}`,
                              true
                            )
                          }
                        >
                          Approve
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="group-block">
                  <h3>Members</h3>
                  {group.members.length === 0 && <p className="group-empty">Nobody yet.</p>}
                  {group.members.map((person) => (
                    <div key={person.userId} className="group-line">
                      <div className="group-line-text">
                        <span>{person.name || person.email}</span>
                        {person.name && <small>{person.email}</small>}
                      </div>
                      <Tooltip title="Take out of the group">
                        <Button
                          size="small"
                          type="text"
                          danger
                          loading={busy === `out-${group.id}-${person.userId}`}
                          onClick={() =>
                            act(
                              `out-${group.id}-${person.userId}`,
                              () => axios.delete(`/api/companies/${companyId}/groups/${group.id}/members/${person.userId}`),
                              "Taken out of the group",
                              true
                            )
                          }
                        >
                          Remove
                        </Button>
                      </Tooltip>
                    </div>
                  ))}
                  {candidates.length > 0 && (
                    <div className="group-add">
                      <Select
                        mode="multiple"
                        placeholder="Add members"
                        value={adding[group.id] || []}
                        onChange={(value) => setAdding((current) => ({ ...current, [group.id]: value }))}
                        options={candidates.map((member) => ({ value: member.userId as number, label: member.email }))}
                        optionFilterProp="label"
                      />
                      <Button
                        icon={<UserAddOutlined />}
                        disabled={!(adding[group.id] || []).length}
                        loading={busy === `add-${group.id}`}
                        onClick={async () => {
                          const ok = await act(
                            `add-${group.id}`,
                            () => axios.post(`/api/companies/${companyId}/groups/${group.id}/members`, { userIds: adding[group.id] }),
                            "Added to the group",
                            true
                          );
                          if (ok) setAdding((current) => ({ ...current, [group.id]: [] }));
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>

                <div className="group-block">
                  <h3>Collections</h3>
                  {group.collections.length === 0 && <p className="group-empty">None shared with this group yet.</p>}
                  {group.collections.map((item) => (
                    <div key={item.collectionId} className="group-line">
                      <div className="group-line-text">
                        <span>{collectionLabel(item.collectionId)}</span>
                      </div>
                      <Select
                        size="small"
                        aria-label="Permission"
                        value={item.permission}
                        disabled={busy === `perm-${group.id}-${item.collectionId}`}
                        onChange={(permission) =>
                          act(
                            `perm-${group.id}-${item.collectionId}`,
                            () =>
                              axios.post(`/api/companies/${companyId}/collections/${item.collectionId}/groups`, {
                                groupId: group.id,
                                permission,
                              }),
                            "Permission changed"
                          )
                        }
                        options={[
                          { value: "view", label: "Can view" },
                          { value: "edit", label: "Can edit" },
                        ]}
                        popupMatchSelectWidth={false}
                      />
                      <Button
                        size="small"
                        type="text"
                        danger
                        loading={busy === `unshare-${group.id}-${item.collectionId}`}
                        onClick={() =>
                          act(
                            `unshare-${group.id}-${item.collectionId}`,
                            () => axios.delete(`/api/companies/${companyId}/collections/${item.collectionId}/groups/${group.id}`),
                            "Collection removed from the group",
                            true
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {shareable.length > 0 && (
                    <div className="group-add">
                      <Select
                        placeholder="Share a collection"
                        value={share.collectionId}
                        onChange={(collectionId) =>
                          setSharing((current) => ({ ...current, [group.id]: { ...share, collectionId } }))
                        }
                        options={shareable.map((item) => ({ value: item.id, label: item.name }))}
                        optionFilterProp="label"
                        showSearch
                      />
                      <Select
                        aria-label="Permission"
                        value={share.permission}
                        onChange={(permission) => setSharing((current) => ({ ...current, [group.id]: { ...share, permission } }))}
                        options={[
                          { value: "view", label: "Can view" },
                          { value: "edit", label: "Can edit" },
                        ]}
                        popupMatchSelectWidth={false}
                      />
                      <Button
                        disabled={!share.collectionId}
                        loading={busy === `share-${group.id}`}
                        onClick={async () => {
                          const ok = await act(
                            `share-${group.id}`,
                            () =>
                              axios.post(`/api/companies/${companyId}/collections/${share.collectionId}/groups`, {
                                groupId: group.id,
                                permission: share.permission,
                              }),
                            "Shared with the group",
                            true
                          );
                          if (ok) setSharing((current) => ({ ...current, [group.id]: { permission: "view" } }));
                        }}
                      >
                        Share
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        title="New group"
        open={creating}
        okText="Create"
        confirmLoading={busy === "create"}
        onOk={create}
        onCancel={() => {
          setName("");
          setCreating(false);
        }}
        destroyOnClose
      >
        <Input
          autoFocus
          maxLength={80}
          placeholder="Group name, such as Engineering"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={create}
        />
        <p className="group-modal-note">Group names are visible to everyone in {companyName}.</p>
      </Modal>
    </>
  );
};

export default GroupsPanel;
