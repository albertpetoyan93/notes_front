import { Select } from "antd";
import { useEffect, useState } from "react";
import {
  Country,
  State,
  City,
  ICountry,
  IState,
  ICity,
} from "country-state-city";

interface CountryRegionCitySelectProps {
  value?: {
    country?: ICountry | null;
    state?: IState | null;
    city?: ICity | null;
  };
  onChange?: (value: {
    country?: ICountry | null;
    state?: IState | null;
    city?: ICity | null;
  }) => void;
  labels?: {
    country?: string;
    state?: string;
    city?: string;
  };
  style?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
}

const CountryRegionCitySelect = ({
  value = {},
  onChange,
  labels = {},
  style = {},
  selectStyle = {},
}: CountryRegionCitySelectProps) => {
  const [countryList, setCountryList] = useState<ICountry[]>([]);
  const [stateList, setStateList] = useState<IState[]>([]);
  const [cityList, setCityList] = useState<ICity[]>([]);

  useEffect(() => {
    setCountryList(Country.getAllCountries());
  }, []);

  useEffect(() => {
    if (value.country) {
      setStateList(State.getStatesOfCountry(value.country.isoCode));
    } else {
      setStateList([]);
    }
    setCityList([]);
  }, [value.country]);

  useEffect(() => {
    if (value.country && value.state) {
      setCityList(
        City.getCitiesOfState(value.country.isoCode, value.state.isoCode)
      );
    } else {
      setCityList([]);
    }
  }, [value.country, value.state]);

  return (
    <div style={{ display: "flex", gap: 8, ...style }}>
      <Select
        placeholder={labels.country || "Country"}
        style={{ minWidth: 120, ...selectStyle }}
        value={value.country?.isoCode}
        onChange={(_, option: any) => {
          const country = countryList.find((c) => c.isoCode === option.key);
          if (onChange) onChange({ country, state: null, city: null });
        }}
        showSearch
        optionFilterProp="children"
      >
        {countryList.map((country) => (
          <Select.Option key={country.isoCode} value={country.isoCode}>
            {country.name}
          </Select.Option>
        ))}
      </Select>
      <Select
        placeholder={labels.state || "State/Region"}
        style={{ minWidth: 120, ...selectStyle }}
        value={value.state?.isoCode}
        onChange={(_, option: any) => {
          const state = stateList.find((s) => s.isoCode === option.key);
          if (onChange) onChange({ ...value, state, city: null });
        }}
        disabled={!value.country}
        showSearch
        optionFilterProp="children"
      >
        {stateList.map((state) => (
          <Select.Option key={state.isoCode} value={state.isoCode}>
            {state.name}
          </Select.Option>
        ))}
      </Select>
      <Select
        placeholder={labels.city || "City"}
        style={{ minWidth: 120, ...selectStyle }}
        value={value.city?.name}
        onChange={(_, option: any) => {
          const city = cityList.find((c) => c.name === option.value);
          if (onChange) onChange({ ...value, city });
        }}
        disabled={!value.state}
        showSearch
        optionFilterProp="children"
      >
        {cityList.map((city) => (
          <Select.Option key={city.name} value={city.name}>
            {city.name}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

export default CountryRegionCitySelect;
