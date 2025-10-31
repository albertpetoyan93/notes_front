import React from "react";
import { Dropdown, Button } from "antd";
import { BgColorsOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useThemeVariant } from "../../contexts/ThemeVariantContext";
import { colorVariants } from "../../configs/theme";
import "./ThemeSelector.scss";

const ThemeSelector: React.FC = () => {
  const { variant, setVariant } = useThemeVariant();

  const items: MenuProps["items"] = Object.entries(colorVariants).map(
    ([key, value]) => ({
      key,
      label: (
        <div className="theme-selector-item">
          <div
            className="theme-color-preview"
            style={{ background: value.gradient }}
          />
          <div className="theme-info">
            <div className="theme-name">{value.name}</div>
            <div className="theme-description">{value.description}</div>
          </div>
          {variant === key && <span className="theme-active">✓</span>}
        </div>
      ),
      onClick: () => setVariant(key as keyof typeof colorVariants),
    })
  );

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={["click"]}>
      <Button
        type="text"
        icon={<BgColorsOutlined style={{ fontSize: 18 }} />}
        className="theme-selector-button"
        title="Change theme"
      />
    </Dropdown>
  );
};

export default ThemeSelector;
