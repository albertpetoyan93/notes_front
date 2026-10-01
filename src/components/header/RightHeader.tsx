import {
  BellOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Avatar, Badge, Button, Dropdown, Empty, theme } from "antd";
import { useCallback, useEffect, useState } from "react";
import { FaPowerOff } from "react-icons/fa6";
import CompanyRequests from "../company/CompanyRequests";
import axios from "../../configs/axios";
import { useTheme } from "../../contexts/ThemeContext";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { useCompanyStore } from "../../store/companyStore";
import CompanyMenu from "./CompanyMenu";

interface AppNotification {
  id: number;
  message: string;
  noteId?: number | null;
  readAt?: string | null;
  createdAt: string;
}

const RightHeader = () => {
  const { mode, handleThemeChange } = useTheme();
  const { logOut } = useAuth();
  const { me } = useAuthStore();
  const { token } = theme.useToken();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const companies = useCompanyStore((state) => state.companies);
  const inviteCount = companies.filter((company) => company.memberStatus === "invited").length;

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

  return (
    <div
      className="header_child"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "8px",
        marginLeft: "auto",
      }}
    >
      <CompanyMenu />
      <div className="header-account">
      <Dropdown
        trigger={["click"]}
        onOpenChange={(open) => {
          if (open) loadNotifications();
        }}
        dropdownRender={() => (
          <div
            style={{
              width: 340,
              maxHeight: 420,
              overflow: "auto",
              background: token.colorBgElevated,
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowSecondary,
              padding: 12,
            }}
          >
            <CompanyRequests compact />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <strong>Notifications</strong>
              {unread > 0 && (
                <Button type="link" size="small" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No notifications"
              />
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: item.readAt
                      ? "transparent"
                      : token.colorFillAlter,
                    borderRadius: token.borderRadius,
                    padding: "8px 10px",
                    marginBottom: 6,
                    cursor: "pointer",
                    color: token.colorText,
                  }}
                >
                  <div>{item.message}</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      >
        <Badge count={unread + inviteCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            aria-label="Notifications"
            icon={<BellOutlined style={{ fontSize: 18 }} />}
            className="header-icon-button"
          />
        </Badge>
      </Dropdown>
      <Dropdown
        trigger={["click"]}
        dropdownRender={(menu) => (
          <div className="avatar-menu">
            <div className="avatar-menu-id">
              <div className="avatar-menu-name">
                {me?.fullName || me?.username}
              </div>
              {me?.email && <div className="avatar-menu-meta">{me.email}</div>}
            </div>
            {menu}
          </div>
        )}
        menu={{
          items: [
            {
              label: `Switch to ${mode === "light" ? "Dark" : "Light"} `,
              key: "1",
              icon:
                mode === "light" ? (
                  <MoonOutlined size={16} />
                ) : (
                  <SunOutlined size={16} />
                ),
              onClick: () => {
                handleThemeChange(mode === "light" ? "dark" : "light");
              },
            },
            {
              label: "Log Out",
              key: "2",
              danger: true,
              icon: <FaPowerOff />,
              onClick: () => {
                logOut();
              },
            },
          ],
        }}
      >
        <Avatar
          className="header-avatar"
          size={36}
          style={{
            background: "#7c3aed",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {(me?.fullName || me?.username || "U").trim().charAt(0).toUpperCase()}
        </Avatar>
      </Dropdown>
      </div>
    </div>
  );
};

export default RightHeader;
