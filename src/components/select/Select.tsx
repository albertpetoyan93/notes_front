import { Card, Button, Typography } from "antd";
import styled from "@emotion/styled";
import { useEffect, useRef, useState } from "react";

const StyledCard = styled(Card)(() => ({}));

const Option = styled(Button)(() => ({
  width: "100%",
  marginBottom: "8px",
  fontSize: "12px",
}));

export default function Select({
  title,
  options,
  defaultSelected,
  onSelect,
}: any) {
  const [selected, setSelected] = useState("");
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setSelected(defaultSelected);
    if (defaultSelected && optionRefs.current[defaultSelected]) {
      optionRefs.current[defaultSelected]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [defaultSelected]);

  const handleSelect = (key: any) => {
    onSelect && onSelect(key);
    setSelected(key);
  };

  return (
    <StyledCard
      size="small"
      title={<Typography.Text italic>{title}</Typography.Text>}
    >
      <div
        className="status-select"
        style={{ height: "250px", overflow: "auto", paddingRight: "8px" }}
      >
        {options?.map((option: any) => {
          return (
            <Option
              key={option.key}
              type={selected === option.key ? "primary" : undefined}
              ref={(el) =>
                (optionRefs.current[option.key] = el as HTMLButtonElement)
              }
              onClick={() => handleSelect(option.key)}
            >
              {option.value}
            </Option>
          );
        })}
      </div>
    </StyledCard>
  );
}
