import { TreeSelect } from "antd";
import { countryTree } from "../static/countryTree";

const CountryStateCityTree = (props: any) => {
  const { value = [], onChange } = props;

  console.log("CountryStateCityTree props:", { value, onChange: !!onChange });

  return (
    <TreeSelect
      treeData={countryTree}
      treeCheckable
      showCheckedStrategy={TreeSelect.SHOW_PARENT}
      placeholder={"Please select locations"}
      style={{ width: "100%" }}
      showSearch
      allowClear
      multiple
      treeNodeFilterProp="title"
      value={Array.isArray(value) ? value : []}
      onChange={(newValues) => {
        console.log("TreeSelect onChange:", newValues);
        if (onChange) {
          onChange(newValues);
        }
      }}
      onSelect={(selectedValue, node) => {
        console.log("TreeSelect onSelect:", { selectedValue, node });
      }}
      onDeselect={(deselectedValue, node) => {
        console.log("TreeSelect onDeselect:", { deselectedValue, node });
      }}
    />
  );
};

export default CountryStateCityTree;
