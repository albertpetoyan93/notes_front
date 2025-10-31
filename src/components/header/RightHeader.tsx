import { MoonOutlined, SunOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Dropdown } from "antd";
import { FaPowerOff } from "react-icons/fa6";
import { useTheme } from "../../contexts/ThemeContext";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import ThemeSelector from "../themeSelector/ThemeSelector";

const RightHeader = () => {
  const { mode, handleThemeChange } = useTheme();
  const { logOut } = useAuth();
  const { me } = useAuthStore();

  return (
    <div
      className="header_child"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "8px",
      }}
    >
      <span style={{ marginRight: "10px" }}>
        {me?.name} {me?.surname}
      </span>
      <ThemeSelector />
      <Dropdown
        trigger={["click"]}
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
          shape="square"
          icon={<UserOutlined />}
          style={{ background: "var(--secondary_1)" }}
        />
      </Dropdown>
    </div>
  );
};

export default RightHeader;
