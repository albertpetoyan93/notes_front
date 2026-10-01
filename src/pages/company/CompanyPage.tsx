import { DeleteOutlined, DownOutlined, FileTextOutlined, ShareAltOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Card, Col, Drawer, Dropdown, Empty, Input, Modal, Row, Select, Space, Spin, Tabs, Tooltip, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "../../configs/axios";
import NotesPage from "../notes/NotesPage";
import { useNoteStore } from "../../store/noteStore";
import { useCompanyStore } from "../../store/companyStore";

interface MemberRow {
  id: number;
  email: string;
  role: "owner" | "admin" | "member";
  status: "invited" | "active" | "removed";
  expiresAt?: string | null;
}

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
  const searchTimer = useRef<number>();
  const requestedTab = searchParams.get("tab") || "notes";
  const companyTab =
    canManage && ["collections", "members", "settings"].includes(requestedTab)
      ? requestedTab
      : "notes";

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

  const removeMember = (member: MemberRow) => {
    Modal.confirm({
      title: member.status === "invited" ? "Cancel this invite?" : `Remove ${member.email}?`,
      content:
        member.status === "invited"
          ? "They will not be able to join unless you invite them again."
          : "They lose this company. Their personal notes stay theirs.",
      okText: member.status === "invited" ? "Cancel invite" : "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        await axios.delete(`/api/companies/${companyId}/members/${member.id}`);
        message.success(member.status === "invited" ? "Invite cancelled" : "Member removed");
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
      <Empty description="You do not have access to this company">
        <Button onClick={() => navigate("/notes")}>Back to notes</Button>
      </Empty>
    );
  }

  if (company.memberStatus === "invited") return null;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Tabs
        activeKey={companyTab}
        tabBarStyle={{ display: "none" }}
        items={[
          {
            key: "notes",
            label: "Notes",
            children: (
              <NotesPage
                companyId={companyId}
                collectionKey={companyCollections
                  .map((collection) => `${collection.id}:${collection.permission}:${collection.name}`)
                  .join("|")}
              />
            ),
          },
          ...(canManage
            ? [
                {
                  key: "collections",
                  label: "Collections",
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button onClick={() => setCollectionOpen(true)}>New collection</Button>
                      </div>
                      {companyCollections.length === 0 ? (
                        <Empty description="No collections yet." />
                      ) : (
                        <div className="notes-page company-notes">
                          <Row gutter={[16, 16]}>
                            {companyCollections.map((collection) => (
                                <Col xs={24} sm={12} lg={6} xl={4} key={collection.id}>
                                  <Card
                                    className="note-card"
                                    actions={[
                                      <Tooltip key="notes" title="Notes">
                                        <Button
                                          type="text"
                                          icon={<FileTextOutlined />}
                                          aria-label="Notes"
                                          onClick={() => {
                                            setSearchParams(
                                              (prev) => {
                                                const next = new URLSearchParams(prev);
                                                next.set("collection", String(collection.id));
                                                next.delete("tab");
                                                return next;
                                              },
                                              { replace: true }
                                            );
                                          }}
                                        />
                                      </Tooltip>,
                                      <Tooltip key="viewers" title="Viewers">
                                        <Button
                                          type="text"
                                          icon={<TeamOutlined />}
                                          aria-label="Viewers"
                                          onClick={() => setAccessCollection(collection)}
                                        />
                                      </Tooltip>,
                                      <Tooltip key="share" title="Share">
                                        <Button
                                          type="text"
                                          icon={<ShareAltOutlined />}
                                          aria-label="Share"
                                          onClick={() => {
                                            setSharingCollection(collection);
                                            setShareAudience(collection.companyShare ? "all" : "members");
                                            setSharePermission(collection.companyShare || "view");
                                            setShareEmails([]);
                                            setUserOptions([]);
                                          }}
                                        />
                                      </Tooltip>,
                                    ]}
                                  >
                                    <div className="note-title-row">
                                      <Typography.Title level={5} ellipsis className="note-title">
                                        {collection.name}
                                      </Typography.Title>
                                    </div>
                                    <Typography.Paragraph className="note-content" style={{ marginBottom: 4 }}>
                                      {collection.noteCount}{" "}
                                      {collection.noteCount === 1 ? "note" : "notes"}
                                    </Typography.Paragraph>
                                    <Typography.Text type="secondary" className="note-date">
                                      {viewerLabel(collection)}
                                    </Typography.Text>
                                  </Card>
                                </Col>
                            ))}
                          </Row>
                        </div>
                      )}
                    </Space>
                  ),
                },
                {
                  key: "members",
                  label: "Members",
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button type="primary" onClick={() => setInviteOpen(true)}>
                          Invite
                        </Button>
                      </div>
                      {membersLoading ? (
                    <div className="notes-page company-notes">
                      <div className="notes-loading">
                        <Spin size="large" />
                      </div>
                    </div>
                  ) : members.length === 0 ? (
                    <Empty description="No members yet." />
                  ) : (
                    <div className="notes-page company-notes">
                      <Row gutter={[16, 16]}>
                        {members.map((member) => {
                          const canChangeRole =
                            company.role === "owner" &&
                            member.role !== "owner" &&
                            member.status !== "removed";
                          const canRemove =
                            member.role !== "owner" &&
                            member.status !== "removed" &&
                            (company.role === "owner" || member.role === "member");
                          const statusLabel =
                            member.status === "active"
                              ? "Active"
                              : member.status === "invited"
                                ? "Invited"
                                : "Removed";
                          return (
                            <Col xs={24} sm={12} lg={6} xl={4} key={member.id}>
                              <Card
                                className="note-card"
                                actions={
                                  canRemove
                                    ? [
                                        <Tooltip
                                          key="remove"
                                          title={member.status === "invited" ? "Cancel invite" : "Remove"}
                                        >
                                          <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            aria-label={member.status === "invited" ? "Cancel invite" : "Remove"}
                                            onClick={() => removeMember(member)}
                                          />
                                        </Tooltip>,
                                      ]
                                    : undefined
                                }
                              >
                                <div className="member-card-top">
                                  <div className="note-title-row">
                                    <Typography.Title level={5} ellipsis className="note-title">
                                      {member.email}
                                    </Typography.Title>
                                  </div>
                                  <span className={`company-role member-status ${member.status}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="member-meta">
                                  {canChangeRole ? (
                                    <Dropdown
                                      trigger={["click"]}
                                      disabled={roleSavingId === member.id}
                                      menu={{
                                        selectedKeys: [member.role],
                                        onClick: ({ key }) =>
                                          changeRole(member, key as "admin" | "member"),
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
                                      >
                                        {roleLabel[member.role]}
                                        <DownOutlined />
                                      </button>
                                    </Dropdown>
                                  ) : (
                                    <span className={`company-role ${member.role}`}>
                                      {roleLabel[member.role]}
                                    </span>
                                  )}
                                </div>
                              </Card>
                            </Col>
                          );
                        })}
                      </Row>
                    </div>
                      )}
                    </Space>
                  ),
                },
                {
                  key: "settings",
                  label: "Settings",
                  children: (
                    <Space direction="vertical" size={8} style={{ maxWidth: 360, width: "100%" }}>
                      <Typography.Text>Company name</Typography.Text>
                      <Input
                        maxLength={100}
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                      />
                      <Button type="primary" loading={saving} onClick={saveName}>
                        Save
                      </Button>
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
      />
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
    </Space>
  );
};

export default CompanyPage;
