import { Badge, Button, theme } from "antd";
import Input from "antd/es/input/Input";
import { FilterFilled, SearchOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import FilterSlider from "../components/filterSlider/FilterSlider";

export const getColumnSearchProps = ({ dataIndex }: any) => {
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => {
      useEffect(() => {
        setSelectedKeys([searchParams.get(dataIndex)]);
      }, []);

      return (
        <div style={{ padding: 8 }}>
          <Input
            placeholder={`Search ${dataIndex}`}
            value={selectedKeys[0]}
            onChange={(e) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
            onPressEnter={() => {
              confirm();
            }}
            style={{ marginBottom: 8, display: "block" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90, marginRight: 8 }}
            >
              Reset
            </Button>
            <Button
              type="primary"
              onClick={() => {
                confirm();
              }}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
          </div>
        </div>
      );
    },
    filteredValue: searchParams.get(dataIndex)
      ? [searchParams.get(dataIndex)]
      : [],
    filterIcon: (filtered: any) => {
      return (
        <Badge dot={!!searchParams.get(dataIndex)} color="red">
          <SearchOutlined
            style={{ color: filtered ? `${token.colorPrimary}` : "#b1b1b1" }}
          />
        </Badge>
      );
    },
    onFilter: (value: any, record: any) =>
      record[dataIndex]?.toString().toLowerCase().includes(value.toLowerCase()),
  };
};
export const getColumnSearchPropsMultiple = ({
  dataIndex,
  lang,
  token,
  searchParams,
  setSearchParams,
}: any) => {
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => {
      useEffect(() => {
        setSelectedKeys([searchParams.get(dataIndex)]);
      }, []);

      return (
        <div style={{ padding: 8 }}>
          <Input
            placeholder={`Search ${dataIndex}`}
            value={selectedKeys[0]}
            onChange={(e) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
            onPressEnter={() => {
              // confirm();
            }}
            style={{ marginBottom: 8, display: "block" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90, marginRight: 8 }}
            >
              Reset
            </Button>
            <Button
              type="primary"
              onClick={() => {
                confirm();
                setSearchParams((prev: URLSearchParams) => {
                  const params = new URLSearchParams(prev);
                  params.set("language_id", lang);
                  params.set("lang_text", selectedKeys[0] || "");
                  return params;
                });
              }}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
          </div>
        </div>
      );
    },
    filteredValue: searchParams.get(dataIndex)
      ? [searchParams.get(dataIndex)]
      : [],
    filterIcon: (filtered: any) => {
      return (
        <Badge dot={!!searchParams.get(dataIndex)} color="red">
          <SearchOutlined
            style={{ color: filtered ? `${token.colorPrimary}` : "#b1b1b1" }}
          />
        </Badge>
      );
    },
    onFilter: (value: any, record: any) =>
      record[dataIndex]?.toString().toLowerCase().includes(value.toLowerCase()),
  };
};

export const getColumnFiterProps = ({ dataIndex, filters }: any) => {
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();

  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => {
      useEffect(() => {
        setSelectedKeys([searchParams.get(dataIndex)]);
      }, []);

      return (
        <div style={{ padding: 8 }}>
          <FilterSlider
            list={filters}
            selectedKeys={selectedKeys}
            setSelectedKeys={setSelectedKeys}
            confirm={confirm}
            clearFilters={clearFilters}
            dataIndex={dataIndex}
          />
        </div>
      );
    },
    filteredValue: searchParams.get(dataIndex)
      ? searchParams.get(dataIndex)?.split(",")
      : [],
    filterIcon: ({}: any) => (
      <Badge dot={!!searchParams.get(dataIndex)} color="red">
        <FilterFilled
          style={{
            color: !!searchParams.get(dataIndex)
              ? `${token.colorPrimary}`
              : "#b1b1b1",
          }}
        />
      </Badge>
    ),
  };
};
