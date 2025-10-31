import ReactECharts from "echarts-for-react";
import * as echarts from "echarts"; // Import echarts to register the map
import usGeo from "../../../mock/worldPopulation.json";

// Register the custom map

const WorldMapChart: React.FC = () => {
  echarts.registerMap("USA", usGeo as any);
  const getOption = () => ({
    title: {
      text: "World Population Estimates",
      subtext: "Data from census sources",
      left: "right",
    },
    tooltip: {
      trigger: "item",
      showDelay: 0,
      transitionDuration: 0.2,
    },
    visualMap: {
      left: "right",
      min: 1000000,
      max: 1400000000,
      inRange: {
        color: ["#313695", "#74add1", "#e0f3f8", "#fee090", "#d73027"],
      },
      text: ["High", "Low"],
      calculable: true,
    },
    toolbox: {
      show: true,
      left: "left",
      top: "top",
      feature: {
        dataView: { readOnly: false },
        restore: {},
        saveAsImage: {},
      },
    },
    series: [
      {
        name: "Population",
        type: "map",
        roam: true,
        map: "world", // Use the registered map name
        emphasis: { label: { show: true } },
        data: [
          { name: "China", value: 1403500365 },
          { name: "India", value: 1366417754 },
          { name: "United States", value: 331883986 },
          { name: "Indonesia", value: 273523621 },
          { name: "Pakistan", value: 220892331 },
          { name: "Brazil", value: 212559409 },
          { name: "Nigeria", value: 206139587 },
          { name: "Bangladesh", value: 164689383 },
          { name: "Russia", value: 145934460 },
          { name: "Mexico", value: 128932753 },
        ],
      },
    ],
  });

  return (
    <div>
      <ReactECharts
        option={getOption() as echarts.EChartsOption}
        style={{ height: 600, width: "100%" }}
      />
    </div>
  );
};

export default WorldMapChart;
