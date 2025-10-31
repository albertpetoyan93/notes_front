import { Radio } from "antd";
import { useEffect, useState } from "react";

const SelectableButtonGroup = ({ defaultSelected, options }: any) => {
  const [selectedValue, setSelectedValue] = useState("");
  useEffect(() => {
    setSelectedValue(defaultSelected);
  }, []);
  const handleChange = (e: any) => {
    setSelectedValue(e.target.value);
  };

  return (
    <div style={{}}>
      <div style={{}}>
        <Radio.Group
          value={selectedValue}
          onChange={handleChange}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "16px",
            borderRadius: "8px",
          }}
        >
          {options.map((option: any) => (
            <Radio.Button
              key={option.key}
              value={option.value}
              style={{
                textAlign: "center",
                padding: "8px 16px",
                backgroundColor:
                  selectedValue === option.key ? "#2ec4b6" : "inherit",
                color: selectedValue === option.key ? "#fff" : "#ccc",
                border: "1px solid #444",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {option.value}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>
    </div>
  );
};

export default SelectableButtonGroup;
