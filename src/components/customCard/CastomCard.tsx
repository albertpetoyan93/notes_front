import { Card } from "antd";

interface CastomCardProps {
  actions?: any[];
  children?: any;
  title?: string;
  className?: string;
}

const CastomCard = ({
  title,
  actions,
  className,
  children,
}: CastomCardProps) => {
  return (
    <Card
      title={title}
      className={"h-100" + (className ? " " + className : "")}
      styles={{
        body: {
          display: "flex",
          flexDirection: "column",
          height: "calc(100% - 112px)",
        },
      }}
      actions={actions}
    >
      {children}
    </Card>
  );
};

export default CastomCard;
