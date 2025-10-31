import { Form, Input, Select } from "antd";
import { getCountryList } from "../../utils/countryCodes";

const PhoneInputCustom = ({ number, onChange }: any) => {
  const prefixSelector = (
    <Form.Item name="prefix" noStyle>
      <Select
        optionLabelProp="label"
        style={{ width: 120 }}
        dropdownStyle={{ width: 200 }}
        onChange={(value) => console.log(value)}
        value={"am"}
      >
        {getCountryList().map((country) => {
          return (
            <Select.Option
              key={country.code}
              value={country.phoneCode}
              label={
                <>
                  <img
                    src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                    alt={country.name}
                    style={{ width: "20px", marginRight: "8px" }}
                  />
                  {country.phoneCode}
                </>
              }
            >
              <img
                src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                alt={country.name}
                style={{ width: "20px", marginRight: "8px" }}
              />{" "}
              {country.phoneCode} {country.name}
            </Select.Option>
          );
        })}
      </Select>
    </Form.Item>
  );
  return (
    <Input
      addonBefore={prefixSelector}
      style={{ width: "100%" }}
      value={number}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

export default PhoneInputCustom;
