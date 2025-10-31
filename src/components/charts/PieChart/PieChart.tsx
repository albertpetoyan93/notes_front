import ReactEcharts from "echarts-for-react";
import { useTheme } from "../../../contexts/ThemeContext";
import "./style.scss";
import { useEffect, useRef } from "react";

const PieChart = ({ type }: any) => {
  const ref = useRef<ReactEcharts>(null);
  const { theme } = useTheme();
  const option: echarts.EChartsOption = {
    color: [
      theme.token.secondary_1,
      theme.token.secondary_2,
      theme.token.primary,
    ],
    tooltip: {
      trigger: "item",
    },
    legend: {
      top: "5%",
      left: "center",
    },
    series: [
      {
        name: "Access From",
        type: "pie",
        radius: type == "donut" ? ["40%", "70%"] : ["50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: {
          show: type == "donut" ? true : false,
          position: "center",
          formatter: (params: any) => {
            return params.value;
          },
          fontSize: 24,
          fontWeight: "bold",
          color: "#333",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 40,
            fontWeight: "bold",
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          { value: 1048, name: "Polls" },
          { value: 735, name: "User" },
          { value: 580, name: "Pages" },
        ],
      },
    ],
  };
  useEffect(() => {
    const chart = ref?.current?.getEchartsInstance();
    chart?.resize();

    const handleResize = () => {
      chart?.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="chart-block">
      <ReactEcharts
        ref={ref}
        className="pie-chart"
        option={option}
        style={{ height: "400px", width: "350px" }}
      />
    </div>
  );
};

export default PieChart;
