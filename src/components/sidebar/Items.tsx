import { FileTextOutlined, AppstoreOutlined } from "@ant-design/icons";

export const items = [
  {
    key: "/",
    icon: <AppstoreOutlined />,
    label: "All Notes",
    roles: ["user"],
  },
  {
    key: "notes",
    icon: <FileTextOutlined />,
    label: "Notes",
    roles: ["user"],
  },
];
