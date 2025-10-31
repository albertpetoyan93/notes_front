import { ReactNode } from "react";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";

export interface loginStatusesTypes {
  key: string;
  value: string;
  badge: string;
  icon: ReactNode;
}

export const userStatuses = {
  CREATED: {
    key: "CREATED",
    tag: (
      <Tag icon={<SyncOutlined spin />} color="processing">
        CREATED
      </Tag>
    ),
  },
  VERIFIED: {
    key: "VERIFIED",
    tag: (
      <Tag icon={<CheckCircleOutlined />} color="success">
        VERIFIED
      </Tag>
    ),
  },
  BLOCKED: {
    key: "BLOCKED",
    tag: (
      <Tag icon={<CloseCircleOutlined />} color="error">
        BLOCKED
      </Tag>
    ),
  },
  PENDING: {
    key: "PENDING",
    tag: (
      <Tag icon={<SyncOutlined spin />} color="processing">
        PENDING
      </Tag>
    ),
  },
  NOT_VERIFIED: {
    key: "NOT_VERIFIED",
    tag: (
      <Tag icon={<SyncOutlined spin />} color="warning">
        NOT_VERIFIED
      </Tag>
    ),
  },
  DELETED: {
    key: "DELETED",
    tag: (
      <Tag icon={<MinusCircleOutlined />} color="default">
        DELETED
      </Tag>
    ),
  },
};
