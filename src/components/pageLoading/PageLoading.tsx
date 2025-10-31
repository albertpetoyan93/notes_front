import { Flex, Spin } from "antd";

const PageLoading = () => {
  return (
    <Flex
      align="center"
      gap="middle"
      style={{
        justifyContent: "center",
        height: "100%",
        width: "100%",
        position: "absolute",
        left: 0,
        top: 0,
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        zIndex: 1,
        opacity: 0.8,
        // backdropFilter: "blur(5px)",
      }}
    >
      <Spin size="large" />
    </Flex>
  );
};

export default PageLoading;
