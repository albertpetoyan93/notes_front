import { LinkOutlined, LockOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Spin, Tag, Tooltip, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import SendLinkModal from "../../components/secretLink/SendLinkModal";
import { fetcherDelete, fetcherGet } from "../../configs/axios";
import dayjsExtra from "../../utils/dayjs";
import "../company/CompanyPage.scss";
import "./SecurityPage.scss";

interface LinkRow {
  id: string;
  label: string;
  noteId: number | null;
  createdAt: string;
  expiresAt: string;
  maxViews: number;
  viewCount: number;
  openedAt: string | null;
  passphrase: boolean;
  status: "active" | "used" | "expired" | "revoked";
}

const STATUS: Record<LinkRow["status"], { text: string; color?: string }> = {
  active: { text: "Active", color: "green" },
  used: { text: "Opened" },
  expired: { text: "Expired" },
  revoked: { text: "Cancelled" },
};

// The one-time links you made: who still can open them, and a way to cancel.
const SecretLinksPage = () => {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLinks(await fetcherGet("/api/secrets"));
    } catch (error: any) {
      message.error(error?.message || "Could not load your links");
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = (link: LinkRow) =>
    Modal.confirm({
      title: "Cancel this link?",
      content: "It stops working at once, and its encrypted secret is deleted.",
      okText: "Cancel link",
      okButtonProps: { danger: true },
      cancelText: "Keep it",
      onOk: async () => {
        try {
          await fetcherDelete(`/api/secrets/${link.id}`);
          message.success("Link cancelled");
          load();
        } catch (error: any) {
          message.error(error?.message || "Could not cancel the link");
        }
      },
    });

  return (
    <div className="manage-page security-page">
      <div className="manage-head">
        <div>
          <h1>One-time links</h1>
          <p>
            Send a password or note to someone without a 2keevo account. Each link is encrypted
            in your browser and stops working after it's opened or when it expires.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          New link
        </Button>
      </div>

      <section className="security-section">
        <h2>Your links</h2>
        <p className="security-section-note">
          To send an item, open it and choose <LinkOutlined /> Send as a one-time link.
        </p>
        {!links ? (
          <div className="security-loading">
            <Spin />
          </div>
        ) : !links.length ? (
          <div className="manage-card">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No links yet." />
          </div>
        ) : (
          <div className="manage-list">
            {links.map((link) => (
              <div key={link.id} className="manage-row">
                <span className="manage-icon">
                  <LinkOutlined />
                </span>
                <div className="manage-main">
                  <strong>
                    {link.label || "Untitled link"}{" "}
                    <Tag color={STATUS[link.status].color}>{STATUS[link.status].text}</Tag>
                    {link.passphrase && (
                      <Tooltip title="Needs a passphrase">
                        <LockOutlined className="link-lock" />
                      </Tooltip>
                    )}
                  </strong>
                  <span>
                    {`Opened ${link.viewCount} of ${link.maxViews} ${link.maxViews === 1 ? "time" : "times"}`}
                    {link.openedAt ? ` · last ${dayjsExtra(link.openedAt).fromNow()}` : ""}
                    {" · "}
                    {link.status === "active"
                      ? `expires ${dayjsExtra(link.expiresAt).fromNow()}`
                      : `created ${dayjsExtra(link.createdAt).format("D MMM YYYY")}`}
                  </span>
                </div>
                {link.status === "active" && (
                  <div className="manage-actions">
                    <Button danger onClick={() => revoke(link)}>
                      Cancel link
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <SendLinkModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
};

export default SecretLinksPage;
