import { Select } from "antd";
import React from "react";

export const getAddressName = (array: any) => {
  const en = array.find((t: any) => t.language?.key === "en");
  return en?.name || array[0]?.name || "Unnamed";
};

export const renderMenuOptions = (menuItems: any) => {
  // Separate parents and children
  const parents = menuItems.filter((item: any) => !item.subgroup);
  const children = menuItems.filter((item: any) => item.subgroup);

  return parents.map((parent: any) => {
    const label = getAddressName(parent.stp_menu_text);
    const childNodes = children.filter(
      (child: any) => child.subgroup === parent.id
    );

    return (
      <React.Fragment key={parent.id}>
        <Select.Option key={parent.id} value={parent.id}>
          {label}
        </Select.Option>

        {childNodes.map((child: any) => {
          const childLabel = getAddressName(child.stp_menu_text);

          return (
            <Select.Option key={child.id} value={child.id}>
              {`${"\u00A0".repeat(4)}`} {childLabel}
            </Select.Option>
          );
        })}
      </React.Fragment>
    );
  });
};
