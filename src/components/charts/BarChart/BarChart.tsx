import ReactEcharts from "echarts-for-react";
import { useTheme } from "../../../contexts/ThemeContext";
import "./style.scss";

const BarChart = () => {
  const { theme } = useTheme();

  const option: echarts.EChartsOption = {
    color: [
      theme.token.secondary_1,
      theme.token.secondary_2,
      theme.token.primary,
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
    },
    legend: {
      data: ["Forest", "Steppe", "Desert", "Wetland"],
    },
    // toolbox: {
    //   show: true,
    //   orient: "vertical",
    //   left: "right",
    //   top: "center",
    //   feature: {
    //     mark: { show: true },
    //     dataView: { show: true, readOnly: false },
    //     magicType: { show: true, type: ["line", "bar", "stack"] },
    //     restore: { show: true },
    //     saveAsImage: { show: true },
    //   },
    // },
    xAxis: [
      {
        type: "category" as const,
        axisTick: { show: false },
        data: ["2012", "2013", "2014", "2015", "2016"],
      },
    ],
    yAxis: [
      {
        type: "value" as const,
      },
    ],
    series: [
      {
        name: "Forest",
        type: "bar",
        barGap: 0,
        emphasis: {
          focus: "series",
        },
        data: [320, 332, 301, 334, 390],
      },
      {
        name: "Steppe",
        type: "bar",
        emphasis: {
          focus: "series",
        },
        data: [220, 182, 191, 234, 290],
      },
      {
        name: "Desert",
        type: "bar",
        emphasis: {
          focus: "series",
        },
        data: [150, 232, 201, 154, 190],
      },
    ],
  };

  return (
    <div className="chart-block">
      <ReactEcharts
        className="bar-chart"
        option={option}
        style={{ height: "400px", width: "100%" }}
      />
    </div>
  );
};

export default BarChart;
