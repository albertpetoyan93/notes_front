import { Modal } from "antd";

interface CustomModalProps {
  title: string;
  open: boolean;
  onOk: () => void;
  onCancel: (e: any) => void;
  content: any;
  width?: number;
  footer?: React.ReactNode | ((params: any) => React.ReactNode);
}

const CustomModal = ({
  title,
  open,
  content,
  width,
  onOk,
  onCancel,
  footer,
}: CustomModalProps) => {
  return (
    <Modal
      title={title}
      centered
      open={open}
      onOk={() => onOk()}
      onCancel={() => onCancel(null)}
      width={width}
      footer={footer}
    >
      {content}
    </Modal>
  );
};

export default CustomModal;
