import { Layout, Menu } from "antd";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { useSearchStore } from "../../store/global";
import { items } from "./Items";
import "./styles.scss";
import logo from "/logo.webp";
import { useAuthStore } from "../../store/authStore";

interface SidebarType {
  collapsed: boolean;
}

const Sidebar = ({ collapsed }: SidebarType) => {
  const location = useLocation();
  const { reset } = useSearchStore();
  const navigate = useNavigate();
  const { Sider } = Layout;
  const { mode, theme } = useTheme();
  const { me } = useAuthStore();

  const [selected, setSelected] = useState(
    location.pathname.replace(/^\/+/, "")
  );

  const authItems = items
    ?.filter((i: any) => i.roles?.includes(me?.role))
    .map((i: any) => {
      return {
        key: i.key,
        icon: i.icon,
        label: i.label,
        children: i.children
          ?.filter((i: any) => i.roles?.includes(me?.role))
          .map((child: any) => ({
            key: child.key,
            icon: child.icon,
            label: child.label,
          })),
      };
    });

  useEffect(() => {
    setSelected(location.pathname.replace(/^\/+/, ""));
  }, [location.pathname]);
  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={300}
      style={{
        margin: "16px 0 16px 16px",
        borderRadius: 8,
        background: theme.token.colorBgMenu,
        maxHeight: "calc(100vh - 32px)",
      }}
    >
      <div className="sidebar_header" style={{ margin: "0 0 16px 0" }}>
        <Link to={`/`}>
          <div className="demo-logo-vertical">
            <img src={logo} width={55} alt="logo" />
          </div>
        </Link>
      </div>
      <Menu
        className="sidebar_menu"
        theme={mode}
        mode="inline"
        selectedKeys={[selected]}
        // defaultSelectedKeys={["staff"]}
        onClick={({ key }) => {
          setSelected(key);
          reset();
          navigate(key);
        }}
        items={authItems}
      />
    </Sider>
  );
};

export default Sidebar;
