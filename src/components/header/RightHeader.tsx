import { BellOutlined, LogoutOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Badge, Button, Dropdown, Empty, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import CompanyRequests from "../company/CompanyRequests";
import axios from "../../configs/axios";
import { useTheme } from "../../contexts/ThemeContext";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { useCompanyStore } from "../../store/companyStore";

interface AppNotification {
  id: number;
  message: string;
  noteId?: number | null;
  readAt?: string | null;
  createdAt: string;
}

// Theme switch, notifications and the account menu, at the end of the top bar.
const RightHeader = () => {
  const { mode, handleThemeChange } = useTheme();
  const { logOut } = useAuth();
  const { me } = useAuthStore();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const companies = useCompanyStore((state) => state.companies);
  const inviteCount = companies.filter((company) => company.memberStatus === "invited").length;
  const nextTheme = mode === "light" ? "dark" : "light";

  const loadNotifications = useCallback(async () => {
    try {
      const response = await axios.get("/api/notifications");
      setItems(response.data.items || []);
      setUnread(response.data.unread || 0);
    } catch {
      setItems([]);
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const markRead = async (id: number) => {
    await axios.post(`/api/notifications/${id}/read`);
    await loadNotifications();
  };

  const markAllRead = async () => {
    await axios.post("/api/notifications/read-all");
    await loadNotifications();
  };

  const name = me?.fullName || me?.username || "";

  return (
    <div className="header-account">
      <Tooltip title={`Switch to ${nextTheme} mode`}>
        <Button
          type="text"
          className="icon-btn"
          aria-label={`Switch to ${nextTheme} mode`}
          icon={mode === "light" ? <MoonOutlined /> : <SunOutlined />}
          onClick={() => handleThemeChange(nextTheme)}
        />
      </Tooltip>
      <Dropdown
        trigger={["click"]}
        placement="bottomRight"
        onOpenChange={(open) => {
          if (open) loadNotifications();
        }}
        dropdownRender={() => (
          <div className="notifications-panel">
            <CompanyRequests compact />
            <div className="notifications-head">
              <strong>Notifications</strong>
              {unread > 0 && (
                <Button type="link" size="small" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications" />
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.readAt ? "notification" : "notification is-unread"}
                  onClick={() => markRead(item.id)}
                >
                  <span>{item.message}</span>
                  <time>{new Date(item.createdAt).toLocaleString()}</time>
                </button>
              ))
            )}
          </div>
        )}
      >
        <Badge count={unread + inviteCount} size="small" offset={[-4, 4]}>
          <Button type="text" className="icon-btn" aria-label="Notifications" icon={<BellOutlined />} />
        </Badge>
      </Dropdown>
      <Dropdown
        trigger={["click"]}
        placement="bottomRight"
        dropdownRender={(menu) => (
          <div className="avatar-menu">
            <div className="avatar-menu-id">
              <div className="avatar-menu-name">{name}</div>
              {me?.email && <div className="avatar-menu-meta">{me.email}</div>}
            </div>
            {menu}
          </div>
        )}
        menu={{
          items: [
            {
              label: "Log out",
              key: "logout",
              danger: true,
              icon: <LogoutOutlined />,
              onClick: () => logOut(),
            },
          ],
        }}
      >
        <button type="button" className="avatar-btn" aria-label={`Account: ${name || "you"}`}>
          {(name || "U").trim().charAt(0).toUpperCase()}
        </button>
      </Dropdown>
    </div>
  );
};

export default RightHeader;
