import { Button } from "antd";

const ActionButtons = ({ loading, cancel, submit }: any) => {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <Button style={{ marginRight: "10px" }} onClick={cancel}>
        Cancel
      </Button>
      <Button
        type="primary"
        loading={loading}
        iconPosition={"end"}
        htmlType="submit"
        onClick={submit}
      >
        Submit
      </Button>
    </div>
  );
};

export default ActionButtons;
