import { SearchOutlined } from "@ant-design/icons";
import { Button, Checkbox, Col, Input, Row } from "antd";
import { useState } from "react";

const FilterSlider = ({
  list,
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
}: any) => {
  const [filteredValue, setFilteredValue] = useState<any[]>(list);

  const handleCheckboxChange = (e: any) => {
    const value = e.target.value;
    if (e.target.checked) {
      setSelectedKeys([...selectedKeys, value]);
    } else {
      setSelectedKeys(selectedKeys.filter((key: any) => key !== value));
    }
  };

  const handleConfirm = () => {
    confirm();
  };

  return (
    <div>
      <Input
        placeholder={`Search`}
        onChange={(e) =>
          setFilteredValue(
            list.filter((i: any) =>
              i?.text.toLowerCase().includes(e.target.value.toLowerCase())
            )
          )
        }
        style={{
          marginBottom: 8,
          display: "block",
        }}
      />
      <div
        className="filter_slider custom_slider"
        style={{ padding: 8, width: 200, maxHeight: 200, overflowY: "auto" }}
      >
        <Row>
          {filteredValue?.map((item: any) => {
            return (
              <Col span={24} key={item.value}>
                <Checkbox
                  checked={selectedKeys.includes(item.value)}
                  value={item.value}
                  style={{ lineHeight: "32px" }}
                  onChange={handleCheckboxChange}
                >
                  {item?.text}
                </Checkbox>
              </Col>
            );
          })}
        </Row>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 8,
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
          onClick={handleConfirm}
          icon={<SearchOutlined />}
          size="small"
          style={{ width: 90 }}
        >
          Filter
        </Button>
      </div>
    </div>
  );
};

export default FilterSlider;
