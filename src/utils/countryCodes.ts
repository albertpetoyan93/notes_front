import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import emojiFlags from "emoji-flags";

export const getCountryCodeFromPhone = (phoneCode: string) => {
  return getCountries()
    .find((country) => `+${getCountryCallingCode(country)}` === phoneCode)
    ?.toLowerCase();
};

export const getCountryList = () => {
  return getCountries().map((code: any) => {
    return {
      code: code.toLowerCase(),
      phoneCode: `+${getCountryCallingCode(code)}`,
      flag: emojiFlags.countryCode(code)?.emoji || "🏳",
      name: emojiFlags.countryCode(code)?.name || code,
    };
  });
};
