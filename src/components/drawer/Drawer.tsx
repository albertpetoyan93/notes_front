import { Drawer as AntDrawer } from "antd";

const Drawer = ({ title, onClose, body, open }: any) => {
  return (
    <AntDrawer
      title={title}
      width={720}
      onClose={onClose}
      open={open}
      styles={body && { paddingBottom: 80 }}
      //   extra={<>extra</>}
    >
      {body}
    </AntDrawer>
  );
};

export default Drawer;
