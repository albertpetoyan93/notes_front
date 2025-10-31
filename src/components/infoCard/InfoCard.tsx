import { Card, Descriptions } from "antd";

const InfoCard = ({ items, title }: any) => {
  return (
    <Card title={title} style={{}}>
      <Descriptions bordered layout="vertical" items={items} />
    </Card>
  );
};

export default InfoCard;
