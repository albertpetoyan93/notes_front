import { Tooltip } from "antd";
import dayjsExtra from "../../utils/dayjs";

// "Updated 3 days ago", with the exact date on hover.
const UpdatedAt = ({ value, className }: { value?: string | Date; className?: string }) => {
  if (!value) return null;
  const date = dayjsExtra(value);
  return (
    <Tooltip title={date.format("LLL")}>
      <time className={className} dateTime={date.toISOString()}>
        Updated {date.fromNow()}
      </time>
    </Tooltip>
  );
};

export default UpdatedAt;
