import {
  DeleteOutlined,
  DownOutlined,
  FolderOutlined,
  HistoryOutlined,
  PlusOutlined,
  ShareAltOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Dropdown, Empty, Input, Modal, Select, Space, Spin, Tooltip, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ActivityList from "../../components/activity/ActivityList";
import axios from "../../configs/axios";
import NotesPage from "../notes/NotesPage";
import CompanyPoliciesSection from "./CompanyPoliciesSection";
import { useNoteStore } from "../../store/noteStore";
import { useCompanyStore } from "../../store/companyStore";
import { useVaultStore } from "../../store/vaultStore";
import "./CompanyPage.scss";

interface MemberRow {
  id: number;
  userId?: number | null;
  email: string;
  role: "owner" | "admin" | "member";
  status: "invited" | "active" | "removed";
  expiresAt?: string | null;
}

interface MemberAccess {
  collections: { id: number; name: string; permission: string }[];
  secretsAccessed: { noteId: number; title: string; count: number; lastAt: string }[];
}

// Shown before removing someone: what they could open, so it can be rotated.
const MemberAccessSummary = ({ access }: { access: MemberAccess | null }) => {
  if (!access) {
    return <p>They disappear from the list. Their personal notes stay theirs.</p>;
  }
  const { collections, secretsAccessed } = access;
  return (
    <div className="member-access">
      <p>They lose access to the company at once. Their personal notes stay theirs.</p>
      {collections.length > 0 && (
        <>
          <strong>Collections they could open</strong>
          <ul>
            {collections.map((collection) => (
              <li key={collection.id}>
                {collection.name}{" "}
                <span>({collection.permission === "edit" ? "can edit" : "can view"})</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {secretsAccessed.length > 0 ? (
        <>
          <strong>Secrets they revealed or copied</strong>
          <ul>
            {secretsAccessed.slice(0, 10).map((item) => (
              <li key={item.noteId}>
                {item.title} <span>({item.count}×)</span>
              </li>
            ))}
          </ul>
          <p className="member-access-hint">
            Consider changing these passwords after removing them.
          </p>
        </>
      ) : (
        <p className="member-access-hint">No revealed or copied secrets are on record.</p>
      )}
    </div>
  );
};

interface CollectionShareRow {
  userId: number;
  email: string;
  name: string;
  permission: "view" | "edit";
}

interface CompanyCollection {
  id: number;
  name: string;
  noteCount: number;
  permission: "owner" | "view" | "edit";
  companyShare?: "view" | "edit" | null;
  shares?: CollectionShareRow[];
}

const viewerLabel = (collection: CompanyCollection) => {
  if (collection.companyShare) return "All members";
  const count = collection.shares?.length || 0;
  return `${count} ${count === 1 ? "viewer" : "viewers"}`;
};

const roleLabel = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const CompanyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = Number(id);
  const companies = useCompanyStore((state) => state.companies);
  const loaded = useCompanyStore((state) => state.loaded);
  const load = useCompanyStore((state) => state.load);
  const company = companies.find((item) => item.id === companyId);
  const canManage = company?.role === "owner" || company?.role === "admin";
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);
  const inviteOpen = useCompanyStore((state) => state.inviteOpen);
  const setInviteOpen = useCompanyStore((state) => state.setInviteOpen);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyCollections, setCompanyCollections] = useState<CompanyCollection[]>([]);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [sharingCollection, setSharingCollection] = useState<CompanyCollection | null>(null);
  const [accessCollection, setAccessCollection] = useState<CompanyCollection | null>(null);
  const [shareAudience, setShareAudience] = useState<"members" | "all">("members");
  const [sharePermission, setSharePermission] = useState<"view" | "edit">("view");
  const [shareEmails, setShareEmails] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<
    { value: string; label: string; name: string; email: string }[]
  >([]);
  const searchUsers = useNoteStore((state) => state.searchUsers);
  const refreshVault = useVaultStore((state) => state.refresh);
  const searchTimer = useRef<number>();
  const [activityActor, setActivityActor] = useState<number | null>(null);
  const requestedTab = searchParams.get("tab") || "notes";
  const companyTab =
    canManage && ["collections", "members", "settings", "activity"].includes(requestedTab)
      ? requestedTab
      : "notes";
  const requestedShareId = Number(searchParams.get("share")) || null;

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (company?.memberStatus === "invited") navigate("/notes");
  }, [company?.memberStatus, navigate]);

  useEffect(() => {
    setInviteOpen(false);
    return () => setInviteOpen(false);
  }, [companyId, setInviteOpen]);

  useEffect(() => {
    setCompanyName(company?.name || "");
  }, [company?.name]);

  const loadMembers = async () => {
    if (!canManage) return;
    setMembersLoading(true);
    try {
      const response = await axios.get(`/api/companies/${companyId}/members`);
      setMembers(response.data || []);
    } catch (error: any) {
      message.error(error?.message || "Could not load members");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) loadMembers();
    // Reload when the open company or the viewer's role changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, canManage]);

  const loadWorkspace = async () => {
    const collectionResponse = await axios.get(`/api/companies/${companyId}/collections`);
    const collections = collectionResponse.data || [];
    setCompanyCollections(collections);
    return collections as CompanyCollection[];
  };

  useEffect(() => {
    if (company?.memberStatus !== "active") return;
    loadWorkspace().catch(() => {
      setCompanyCollections([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, company?.memberStatus, companyTab]);

  useEffect(() => {
    if (companyTab !== "collections" || !requestedShareId) return;
    const collection = companyCollections.find((item) => item.id === requestedShareId);
    if (!collection) return;
    setSharingCollection(collection);
    setShareAudience(collection.companyShare ? "all" : "members");
    setSharePermission(collection.companyShare || "view");
    setShareEmails([]);
    setUserOptions([]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("share");
        return next;
      },
      { replace: true }
    );
  }, [companyTab, requestedShareId, companyCollections, setSearchParams]);

  const createCollection = async () => {
    const trimmed = collectionName.trim();
    if (!trimmed) {
      message.warning("Enter a collection name");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/api/companies/${companyId}/collections`, { name: trimmed });
      setCollectionName("");
      setCollectionOpen(false);
      message.success("Collection created");
      await loadWorkspace();
      refreshVault();
    } catch (error: any) {
      message.error(error?.message || "Could not create the collection");
    } finally {
      setSaving(false);
    }
  };

  const searchMembers = (value: string) => {
    window.clearTimeout(searchTimer.current);
    const query = value.trim();
    if (query.length < 2) {
      setUserOptions([]);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      try {
        const users = await searchUsers(query, companyId);
        setUserOptions(
          users.map((user) => ({
            value: user.email,
            label: user.email,
            name: user.fullName || user.username,
            email: user.email,
          }))
        );
      } catch {
        setUserOptions([]);
      }
    }, 300);
  };

  const shareCollection = async () => {
    if (!sharingCollection) return;
    if (shareAudience === "members" && shareEmails.length === 0) {
      message.warning("Choose at least one person");
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post(
        `/api/companies/${companyId}/collections/${sharingCollection.id}/share`,
        {
          audience: shareAudience,
          permission: sharePermission,
          emails: shareEmails,
        }
      );
      const failed = response.data?.failed || [];
      const shared = response.data?.shared || [];
      if (shareAudience === "all" || shared.length) {
        message.success(
          shareAudience === "all"
            ? "Shared with all members"
            : shared.length === 1
              ? "Collection shared"
              : `Shared with ${shared.length} people`
        );
      }
      if (failed.length) {
        message.warning(failed.map((item: { message: string }) => item.message).join("\n"));
      }
      await loadWorkspace();
      refreshVault();
      if (shareAudience === "all" || shared.length) setSharingCollection(null);
      setShareEmails([]);
      setUserOptions([]);
    } catch (error: any) {
      message.error(error?.message || "Could not share the collection");
    } finally {
      setSaving(false);
    }
  };

  const unshareCollection = async (target: { all?: boolean; userId?: number }) => {
    if (!sharingCollection) return;
    const params = target.all ? "all=1" : `userId=${target.userId}`;
    await axios.delete(
      `/api/companies/${companyId}/collections/${sharingCollection.id}/share?${params}`
    );
    message.success(target.all ? "Stopped sharing with everyone" : "Access removed");
    const rows = await loadWorkspace();
    refreshVault();
    setSharingCollection((current) => rows.find((item) => item.id === current?.id) || null);
  };

  const invite = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      message.warning("Enter an email");
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post(`/api/companies/${companyId}/invites`, {
        email: trimmed,
        role: inviteRole,
      });
      setEmail("");
      setInviteRole("member");
      setInviteOpen(false);
      message.success(
        response.data?.emailSent
          ? "Invite sent"
          : "Invite saved. Email is not set up yet, so it was not delivered."
      );
      await loadMembers();
    } catch (error: any) {
      message.error(error?.message || "Could not send the invite");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member: MemberRow, role: "admin" | "member") => {
    if (member.role === role || roleSavingId !== null) return;
    setRoleSavingId(member.id);
    try {
      await axios.put(`/api/companies/${companyId}/members/${member.id}`, { role });
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, role } : item))
      );
      message.success(
        `${member.email} is now ${role === "admin" ? "an admin" : "a member"}`
      );
    } catch (error: any) {
      message.error(error?.message || "Could not change the role");
    } finally {
      setRoleSavingId(null);
    }
  };

  const removeMember = async (member: MemberRow) => {
    const deleting = member.status === "removed";
    let access: MemberAccess | null = null;
    if (member.status === "active") {
      try {
        access = (await axios.get(`/api/companies/${companyId}/members/${member.id}/access`)).data;
      } catch {
        access = null;
      }
    }
    Modal.confirm({
      width: member.status === "active" ? 480 : undefined,
      title: deleting
        ? "Delete this person?"
        : member.status === "invited"
          ? "Cancel this invite?"
          : `Remove ${member.email}?`,
      content:
        member.status === "invited" ? (
          "They will not be able to join unless you invite them again."
        ) : member.status === "active" ? (
          <MemberAccessSummary access={access} />
        ) : (
          "They disappear from the list. You can invite them again later. Their personal notes stay theirs."
        ),
      okText: deleting ? "Delete" : member.status === "invited" ? "Cancel invite" : "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        await axios.delete(`/api/companies/${companyId}/members/${member.id}`);
        message.success(
          deleting
            ? "Deleted"
            : member.status === "invited"
              ? "Invite cancelled"
              : "Member removed"
        );
        await loadMembers();
      },
    });
  };

  const saveName = async () => {
    const trimmed = companyName.trim();
    if (!trimmed) {
      message.warning("Enter a company name");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`/api/companies/${companyId}`, { name: trimmed });
      await load();
      message.success("Company name saved");
    } catch (error: any) {
      message.error(error?.message || "Could not save the name");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  if (!company) {
    return (
      <div className="manage-page">
        <Empty description="You do not have access to this company">
          <Button onClick={() => navigate("/notes")}>Back to your vault</Button>
        </Empty>
      </div>
    );
  }

  if (company.memberStatus === "invited") return null;

  const openCollectionNotes = (collection: CompanyCollection) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("collection", String(collection.id));
        next.delete("tab");
        return next;
      },
      { replace: true }
    );

  const openTab = (tab: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { replace: true }
    );

  const activityUrl = activityActor
    ? `/api/companies/${companyId}/activity?actorId=${activityActor}`
    : `/api/companies/${companyId}/activity`;

  const activeMembers = members.filter((member) => member.status === "active").length;
  const invitedMembers = members.filter((member) => member.status === "invited").length;

  const collectionsPanel = (
    <>
      <div className="manage-head">
        <div>
          <h1 className="display-font">Collections</h1>
          <p>Every item in {company.name} lives in a collection. Share a collection to give people access to it.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCollectionOpen(true)}>
          New collection
        </Button>
      </div>
      {companyCollections.length === 0 ? (
        <div className="manage-empty">No collections yet.</div>
      ) : (
        <ul className="manage-list">
          {companyCollections.map((collection) => (
            <li key={collection.id} className="manage-row">
              <span className="manage-icon">
                <FolderOutlined />
              </span>
              <div className="manage-main">
                <strong>{collection.name}</strong>
                <span>
                  {collection.noteCount} {collection.noteCount === 1 ? "item" : "items"} · {viewerLabel(collection)}
                </span>
              </div>
              <div className="manage-actions">
                <Tooltip title="Who has access">
                  <Button
                    type="text"
                    className="icon-btn"
                    icon={<TeamOutlined />}
                    aria-label={`Who has access to ${collection.name}`}
                    onClick={() => setAccessCollection(collection)}
                  />
                </Tooltip>
                <Button
                  size="small"
                  icon={<ShareAltOutlined />}
                  onClick={() => {
                    setSharingCollection(collection);
                    setShareAudience(collection.companyShare ? "all" : "members");
                    setSharePermission(collection.companyShare || "view");
                    setShareEmails([]);
                    setUserOptions([]);
                  }}
                >
                  Share
                </Button>
                <Button size="small" onClick={() => openCollectionNotes(collection)}>
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const membersPanel = (
    <>
      <div className="manage-head">
        <div>
          <h1 className="display-font">Members</h1>
          <p>
            {activeMembers} active{invitedMembers ? ` · ${invitedMembers} invited` : ""}
          </p>
        </div>
        <Space wrap>
          <Button icon={<HistoryOutlined />} onClick={() => openTab("activity")}>
            Activity log
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviteOpen(true)}>
            Invite
          </Button>
        </Space>
      </div>
      {membersLoading ? (
        <div className="manage-empty">
          <Spin />
        </div>
      ) : members.length === 0 ? (
        <div className="manage-empty">No members yet.</div>
      ) : (
        <ul className="manage-list">
          {members.map((member) => {
            const canChangeRole =
              company.role === "owner" && member.role !== "owner" && member.status !== "removed";
            const canManageMember =
              member.role !== "owner" && (company.role === "owner" || member.role === "member");
            const canRemove = canManageMember && member.status !== "removed";
            const canDelete = canManageMember && member.status === "removed";
            const removeLabel = canDelete
              ? "Delete"
              : member.status === "invited"
                ? "Cancel invite"
                : "Remove";
            return (
              <li key={member.id} className={`manage-row${member.status === "removed" ? " is-muted" : ""}`}>
                <span className="manage-icon is-person">{member.email.charAt(0).toUpperCase()}</span>
                <div className="manage-main">
                  <strong>{member.email}</strong>
                  <span>
                    {member.status === "active"
                      ? "Active"
                      : member.status === "invited"
                        ? "Invite sent"
                        : "Removed"}
                  </span>
                </div>
                <div className="manage-actions">
                  {canChangeRole ? (
                    <Dropdown
                      trigger={["click"]}
                      disabled={roleSavingId === member.id}
                      menu={{
                        selectedKeys: [member.role],
                        onClick: ({ key }) => changeRole(member, key as "admin" | "member"),
                        items: [
                          { key: "member", label: "Member" },
                          { key: "admin", label: "Admin" },
                        ],
                      }}
                    >
                      <button
                        type="button"
                        className={`company-role member-role-trigger ${member.role}`}
                        disabled={roleSavingId === member.id}
                        aria-label={`Role: ${roleLabel[member.role]}. Change role`}
                      >
                        {roleLabel[member.role]}
                        <DownOutlined />
                      </button>
                    </Dropdown>
                  ) : (
                    <span className={`company-role ${member.role}`}>{roleLabel[member.role]}</span>
                  )}
                  {(canRemove || canDelete) && (
                    <Tooltip title={removeLabel}>
                      <Button
                        type="text"
                        className="icon-btn is-danger"
                        icon={<DeleteOutlined />}
                        aria-label={`${removeLabel}: ${member.email}`}
                        onClick={() => removeMember(member)}
                      />
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const activityPanel = (
    <>
      <div className="manage-head">
        <div>
          <h1 className="display-font">Activity log</h1>
          <p>
            Everything that happened in {company.name}: changes to items, who revealed or copied a
            secret, shares and members. Only owners and admins see this.
          </p>
        </div>
        <Select
          allowClear
          placeholder="Everyone"
          style={{ minWidth: 220 }}
          value={activityActor ?? undefined}
          onChange={(value) => setActivityActor(value ?? null)}
          options={members
            .filter((member) => member.userId)
            .map((member) => ({ value: member.userId as number, label: member.email }))}
        />
      </div>
      <section className="manage-card">
        <ActivityList key={activityUrl} url={activityUrl} emptyText="No activity yet." />
      </section>
    </>
  );

  const settingsPanel = (
    <>
      <div className="manage-head">
        <div>
          <h1 className="display-font">Settings</h1>
          <p>The name {company.name} goes by, and the security rules for its members.</p>
        </div>
      </div>
      <section className="manage-card">
        <label htmlFor="company-name">Company name</label>
        <div className="manage-inline">
          <Input
            id="company-name"
            maxLength={100}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            onPressEnter={saveName}
          />
          <Button type="primary" loading={saving} onClick={saveName}>
            Save
          </Button>
        </div>
      </section>
      <CompanyPoliciesSection companyId={companyId} />
    </>
  );

  const panel =
    companyTab === "collections"
      ? collectionsPanel
      : companyTab === "members"
        ? membersPanel
        : companyTab === "settings"
          ? settingsPanel
          : companyTab === "activity"
            ? activityPanel
            : null;

  return (
    <>
      {company.blocked === "2fa" && !panel && (
        <div className="company-blocked" role="alert">
          <div className="company-blocked-text">
            <strong>{company.name} requires two-factor authentication</strong>
            <span>Turn it on for your account to see the company's items.</span>
          </div>
          <Button type="primary" onClick={() => navigate("/settings/security")}>
            Set up two-factor authentication
          </Button>
        </div>
      )}
      {panel ? <div className="manage-page">{panel}</div> : <NotesPage companyId={companyId} />}
      <Modal
        title={`Invite to ${company.name}`}
        open={inviteOpen}
        okText="Send invite"
        confirmLoading={saving}
        onOk={invite}
        onCancel={() => {
          setEmail("");
          setInviteRole("member");
          setInviteOpen(false);
        }}
        destroyOnClose
      >
        <Input
          autoFocus
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onPressEnter={invite}
        />
        <Select
          style={{ width: "100%", marginTop: 12 }}
          value={inviteRole}
          onChange={setInviteRole}
          options={[
            { value: "member", label: "Member" },
            { value: "admin", label: "Admin" },
          ]}
        />
      </Modal>
      <Modal
        title="New collection"
        open={collectionOpen}
        okText="Create"
        confirmLoading={saving}
        onOk={createCollection}
        onCancel={() => {
          setCollectionName("");
          setCollectionOpen(false);
        }}
        destroyOnClose
      >
        <Input
          autoFocus
          maxLength={100}
          placeholder="Collection name"
          value={collectionName}
          onChange={(event) => setCollectionName(event.target.value)}
          onPressEnter={createCollection}
        />
      </Modal>
      <Drawer
        title={accessCollection ? accessCollection.name : "Access"}
        open={!!accessCollection}
        onClose={() => setAccessCollection(null)}
        width={360}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {accessCollection?.companyShare && (
            <div>All company members · {accessCollection.companyShare}</div>
          )}
          {(accessCollection?.shares || []).length === 0 && !accessCollection?.companyShare ? (
            <Empty description="No one has access" />
          ) : (
            accessCollection?.shares?.map((person) => (
              <div key={person.userId}>
                <div>{person.email}</div>
                <Typography.Text type="secondary">{person.permission}</Typography.Text>
              </div>
            ))
          )}
        </Space>
      </Drawer>
      <Modal
        title={sharingCollection ? `Share ${sharingCollection.name}` : "Share"}
        open={!!sharingCollection}
        footer={null}
        onCancel={() => setSharingCollection(null)}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Select
            style={{ width: "100%" }}
            value={shareAudience}
            onChange={setShareAudience}
            options={[
              { value: "members", label: "Selected people" },
              { value: "all", label: "All company members" },
            ]}
          />
          <Select
            style={{ width: "100%" }}
            value={sharePermission}
            onChange={setSharePermission}
            options={[
              { value: "view", label: "View" },
              { value: "edit", label: "Edit" },
            ]}
          />
          {shareAudience === "members" && (
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              style={{ width: "100%" }}
              value={shareEmails}
              onChange={setShareEmails}
              onSearch={searchMembers}
              options={userOptions}
              optionRender={(option) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>{option.data.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{option.data.email}</span>
                </div>
              )}
              placeholder="Search by name or email"
              notFoundContent={null}
            />
          )}
          <Button type="primary" loading={saving} onClick={shareCollection}>
            {shareAudience === "all" ? "Share with everyone" : "Share"}
          </Button>
          {sharingCollection?.companyShare && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>All members · {sharingCollection.companyShare}</span>
              <Button size="small" danger onClick={() => unshareCollection({ all: true })}>
                Stop
              </Button>
            </div>
          )}
          {sharingCollection?.shares?.map((person) => (
            <div
              key={person.userId}
              style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
            >
              <span>
                {person.name || person.email} · {person.permission}
              </span>
              <Button size="small" danger onClick={() => unshareCollection({ userId: person.userId })}>
                Remove
              </Button>
            </div>
          ))}
        </Space>
      </Modal>
    </>
  );
};

export default CompanyPage;
