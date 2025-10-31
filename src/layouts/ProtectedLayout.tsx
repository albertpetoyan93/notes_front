import { Col, Layout, Row } from "antd";
import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import LeftHeader from "../components/header/LeftHeader";
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
  const { getMe, logOut } = useAuth();
  const { me } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (token) {
      if (!me) {
        getMe()
          .then((res) => {
            if (!res) {
              navigate("/auth/login");
            }
          })
          .catch((e) => {
            console.log("Authentication error:", e);
            // logout
            logOut();
            navigate("/auth/login");
          });
      }
    } else {
      console.log("No token found, redirecting to login");
      navigate("/auth/login");
    }
  }, [navigate, getMe, logOut, me]);

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
            height: "64px",
          }}
        >
          <Row style={{ alignItems: "center" }}>
            <Col span={8}>
              <LeftHeader
              // collapsed={collapsed} setCollapsed={setCollapsed}
              />
            </Col>
            <Col span={8}></Col>
            <Col span={8}>
              <RightHeader />
            </Col>
          </Row>
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
