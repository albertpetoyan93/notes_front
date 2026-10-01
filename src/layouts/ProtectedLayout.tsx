import { Layout } from "antd";
import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import CompanyTabs from "../components/header/CompanyTabs";
import LeftHeader from "../components/header/LeftHeader";
import RightHeader from "../components/header/RightHeader";
// import Sidebar from "../components/sidebar/Sidebar";
import useAuth from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";

const { Header, Content } = Layout;

const ProtectedLayout: React.FC = () => {
  const navigate = useNavigate();
  // const [collapsed, setCollapsed] = useState(false);
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
          className="app-header-bar"
          style={{
            margin: "16px 16px 0 16px",
            padding: "0 12px 0 16px",
            background: "transparent",
            borderRadius: 16,
            height: "auto",
            minHeight: 64,
            lineHeight: "normal",
          }}
        >
          <div className="app-header">
            <LeftHeader />
            <div className="header-nav">
              <CompanyTabs />
            </div>
            <RightHeader />
          </div>
        </Header>
        <Content
          style={{
            height: "100%",
            margin: "16px 16px",
            padding: "16px 24px",
            minHeight: 280,
            background: "transparent",
            borderRadius: 16,
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
