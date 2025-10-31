import { Select } from "antd";

const getAddressName = (address_text: any) => {
  const en = address_text.find((t: any) => t.language?.key === "en");
  return en?.name || address_text[0]?.name || "Unnamed";
};

export const renderLocationTree = (nodes: any, depth = 0) => {
  return nodes
    .map((node: any) => {
      const label = `${"\u00A0".repeat(depth * 4)}${getAddressName(
        node.address_text
      )}`;
      return [
        <Select.Option key={node.id} value={node.id}>
          {label}
        </Select.Option>,
        ...(node.children ? renderLocationTree(node.children, depth + 1) : []),
      ];
    })
    .flat();
};
