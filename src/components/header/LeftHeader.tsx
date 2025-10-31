// import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import Title from "antd/es/typography/Title";
import { useThemeVariant } from "../../contexts/ThemeVariantContext";

const LeftHeader = () => {
  const { gradientStyle } = useThemeVariant();

  return (
    <div className="header_child">
      <Title
        level={2}
        style={{
          margin: 0,
          backgroundImage: gradientStyle,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          fontWeight: 700,
        }}
      >
        My Notes
      </Title>
      {/* <span
        style={{ cursor: "pointer", fontSize: "18px", width: 64, height: 64 }}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </span> */}
    </div>
  );
};

export default LeftHeader;
