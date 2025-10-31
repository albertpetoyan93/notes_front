import { Button, Col, Row, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { MdOutlineClear } from "react-icons/md";
import Search, { SearchProps } from "antd/es/input/Search";
const { Title } = Typography;

interface TableHeaderProps {
  title: string;
  onCreate?: () => void;
  searchBar?: boolean;
}

const TableHeader = ({ title, onCreate, searchBar }: TableHeaderProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleResetAll = () => {
    const currentPage = searchParams.get("page") || "1"; // Keep current page
    const currentPageSize = searchParams.get("pageSize") || "10"; // Keep pageSize
    const currentOrder = searchParams.get("order") || "desc"; // Keep pageSize

    setSearchParams({
      page: currentPage,
      pageSize: currentPageSize,
      order: currentOrder,
    }); // Reset everything else
  };
  const onSearch: SearchProps["onSearch"] = (value, _e) =>
    setSearchParams({
      search: value,
    });

  return (
    <Row
      gutter={16}
      align="middle"
      style={{
        marginBottom: 20,
      }}
    >
      <Col xs={24} sm={24} md={24} lg={12} xl={12}>
        <Row
          gutter={16}
          align="middle"
          justify={"start"}
          style={{ width: "100%" }}
        >
          <Col xs={12} sm={12}>
            <Title style={{ margin: 0 }} level={3}>
              {title}
            </Title>
          </Col>
          {searchBar && (
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Search
                placeholder="input search text"
                onSearch={onSearch}
                loading={false}
                allowClear
                onClear={() => {
                  setSearchParams((prev) => {
                    prev.delete("search");
                    return prev;
                  });
                }}
              />
            </Col>
          )}
        </Row>
      </Col>
      <Col xs={24} sm={24} md={24} lg={12} xl={12}>
        <Row
          gutter={16}
          align="middle"
          justify={"end"}
          style={{ width: "100%" }}
        >
          {searchParams.size > 3 && (
            <Col xs={4} sm={6}>
              <Button
                color="danger"
                variant="outlined"
                icon={<MdOutlineClear />}
                onClick={() => {
                  handleResetAll();
                }}
                style={{
                  boxShadow: "none",
                  borderColor: "var(--secondary_1)",
                  color: "var(--secondary_1)",
                  width: "100%",
                }}
              >
                Reset All
              </Button>
            </Col>
          )}
          {onCreate && (
            <Col xs={4} sm={6}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onCreate}
                style={{
                  boxShadow: "none",
                  background: "var(--secondary_1)",
                  width: "100%",
                }}
              >
                Create
              </Button>
            </Col>
          )}
        </Row>
      </Col>
    </Row>
  );
};

export default TableHeader;
