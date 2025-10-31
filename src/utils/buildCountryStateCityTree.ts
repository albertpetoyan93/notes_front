import { Country, State, City } from "country-state-city";

export const buildCountryStateCityTree = () => {
  const allowedCountryCodes = [
    "AM",
    "AR",
    "AU",
    "BR",
    "CA",
    "FR",
    "GE",
    "DE",
    "IR",
    "LB",
    "PL",
    "RU",
    "UA",
    "US",
  ];

  return allowedCountryCodes.map((code) => {
    const country = Country.getCountryByCode(code);
    if (!country) return null;
    const states = State.getStatesOfCountry(code);

    return {
      title: country.name,
      value: country.isoCode,
      type: "country",
      isoCode: country.isoCode,
      children: states.map((state) => {
        const cities = City.getCitiesOfState(country.isoCode, state.isoCode);

        return {
          title: state.name,
          value: `${country.isoCode}-${state.isoCode}`,
          type: "state",
          isoCode: state.isoCode,
          children: cities.map((city) => ({
            title: city.name,
            value: `${country.isoCode}-${state.isoCode}-${city.name}`,
            type: "city",
            isoCode: `${country.isoCode}-${state.isoCode}-${city.name}`,
          })),
        };
      }),
    };
  });
};

export function formatSelectedTree(
  selectedValues: string[],
  countryTree: any[]
) {
  const countryMap = new Map();

  // Helper to find the hierarchy for a single value
  function findHierarchy(
    value: string
  ): { country: any; state?: any; city?: any } | null {
    for (const country of countryTree) {
      if (country.value === value) {
        return { country };
      }
      if (country.children) {
        for (const state of country.children) {
          if (state.value === value) {
            return { country, state };
          }
          if (state.children) {
            for (const city of state.children) {
              if (city.value === value) {
                return { country, state, city };
              }
            }
          }
        }
      }
    }
    return null;
  }

  // Process each selected value
  selectedValues.forEach((value) => {
    const hierarchy = findHierarchy(value);
    if (!hierarchy) return;

    const { country, state, city } = hierarchy;
    const countryKey = country.value;

    // Get or create country entry
    if (!countryMap.has(countryKey)) {
      countryMap.set(countryKey, {
        title: country.title,
        value: country.value,
        children: [],
      });
    }

    const countryEntry = countryMap.get(countryKey);

    if (state) {
      // Find existing state or create new one
      let stateEntry = countryEntry.children.find(
        (s: any) => s.value === state.value
      );

      if (!stateEntry) {
        stateEntry = {
          title: state.title,
          value: state.value,
          children: [],
        };
        countryEntry.children.push(stateEntry);
      }

      if (city) {
        // Add city if it doesn't exist
        const cityExists = stateEntry.children.find(
          (c: any) => c.value === city.value
        );
        if (!cityExists) {
          stateEntry.children.push({
            title: city.title,
            value: city.value,
          });
        }
      } else {
        // If selecting the entire state, include all its children
        stateEntry.children = state.children || [];
      }
    } else {
      // If selecting the entire country, include all its children
      countryEntry.children = country.children || [];
    }
  });

  return Array.from(countryMap.values());
}
