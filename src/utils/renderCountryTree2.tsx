import React, { useState } from "react";
import { TreeSelect } from "antd";
import { Country, State, City } from "country-state-city";

const CountryStateCityTree = () => {
  const [treeData, setTreeData] = useState(
    Country.getAllCountries().map((c) => ({
      title: c.name,
      value: `${c.isoCode}`,
      key: `${c.isoCode}`,
      isLeaf: false, // expandable
      type: "country",
      countryCode: c.isoCode,
      children: [],
    }))
  );
  const onLoadData = (node: any) => {
    return new Promise<void>((resolve) => {
      if (node.type === "country") {
        const states = State.getStatesOfCountry(node.countryCode);

        const children =
          states.length > 0
            ? states.map((s) => ({
                title: s.name,
                value: `${node.countryCode}-${s.isoCode}`,
                key: `${node.countryCode}-${s.isoCode}`,
                isLeaf: false,
                type: "state",
                countryCode: node.countryCode,
                stateCode: s.isoCode,
                children: [], // Add empty children array to show expand icon
              }))
            : [
                {
                  title: "No states found",
                  value: `no-states-${node.countryCode}`,
                  key: `no-states-${node.countryCode}`,
                  isLeaf: true,
                  type: "empty",
                  selectable: false,
                  checkable: false,
                  disableCheckbox: true,
                },
              ];
        setTreeData((origin) => updateTreeData(origin, node.key, children));
        resolve();
      } else if (node.type === "state") {
        const cities = City.getCitiesOfState(node.countryCode, node.stateCode);
        const children =
          cities.length > 0
            ? cities.map((ci) => ({
                title: ci.name,
                value: `${node.countryCode}-${node.stateCode}-${ci.name}`,
                key: `${node.countryCode}-${node.stateCode}-${ci.name}`,
                isLeaf: true,
                type: "city",
              }))
            : [
                {
                  title: "No cities found",
                  value: `no-cities-${node.countryCode}-${node.stateCode}`,
                  key: `no-cities-${node.countryCode}-${node.stateCode}`,
                  isLeaf: true,
                  type: "empty",
                  selectable: false,
                  checkable: false,
                  disableCheckbox: true,
                },
              ];
        setTreeData((origin) => updateTreeData(origin, node.key, children));
        resolve();
      } else {
        resolve();
      }
    });
  };

  // helper to update nested children
  const updateTreeData = (
    list: any[],
    key: React.Key,
    children: any[]
  ): any[] =>
    list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children),
        };
      }
      return node;
    });

  return (
    <TreeSelect
      treeData={treeData}
      loadData={onLoadData} // lazy loading hook
      treeCheckable
      showCheckedStrategy={TreeSelect.SHOW_PARENT}
      placeholder="Please select locations"
      style={{ width: "100%" }}
      showSearch
      allowClear
      multiple
      treeNodeFilterProp="title" // Make sure search works on title property
      filterTreeNode={(input, treeNode) => {
        return (treeNode?.title as string)
          ?.toLowerCase()
          ?.includes(input.toLowerCase());
      }}
    />
  );
};

export default CountryStateCityTree;
