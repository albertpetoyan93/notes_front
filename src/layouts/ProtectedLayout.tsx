import { Layout } from "antd";
import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import LeftHeader from "../components/header/LeftHeader";
import NotesSearch from "../components/header/NotesSearch";
import RightHeader from "../components/header/RightHeader";
// import Sidebar from "../components/sidebar/Sidebar";
import { useTheme } from "../contexts/ThemeContext";
import useAuth from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";

const { Header, Content } = Layout;

const ProtectedLayout: React.FC = () => {
  const navigate = useNavigate();
  // const [collapsed, setCollapsed] = useState(false);
  const { theme } = useTheme();
  const { getMe } = useAuth();
  const { me } = useAuthStore();

  useEffect(() => {
    if (me) return;

    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled && !res) {
          navigate("/auth/login");
        }
      })
      .catch(() => {
        if (!cancelled) {
          navigate("/auth/login");
        }
      });

    return () => {
      cancelled = true;
    };
    // Session check runs once. Later logins update the store themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout style={{}}>
      {/* <Sidebar collapsed={collapsed} /> */}
      <Layout className="site-layout" style={{ minHeight: "100vh" }}>
        <Header
          style={{
            margin: "16px 16px 0 16px",
            padding: "0 24px",
            background: theme.token.colorBgContainer,
            borderRadius: 8,
            height: "auto",
            minHeight: 64,
            lineHeight: "normal",
          }}
        >
          <div className="app-header">
            <LeftHeader />
            <NotesSearch />
            <RightHeader />
          </div>
        </Header>
        <Content
          style={{
            height: "100%",
            margin: "16px 16px",
            padding: "16px 24px",
            minHeight: 280,
            background: theme.token.colorBgContainer,
            borderRadius: 8,
            position: "relative",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ProtectedLayout;
