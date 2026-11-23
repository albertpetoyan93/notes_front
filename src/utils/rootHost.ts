/**
 * The site part people sign in to: "www.shop.example.co.uk" -> "example.co.uk".
 * Same rule as notes_extension/background.js (rootHost) and
 * notes_back/src/services/BreachFeedService.ts: keep the three in step.
 */
export const rootHost = (host: string): string => {
  const name = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[/?#:]/)[0]
    .replace(/^[^@]*@/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  const multi = ["co.uk", "com.au", "co.jp", "com.br", "co.nz", "com.tr", "co.za"];
  for (const suffix of multi) {
    if (name.endsWith(`.${suffix}`)) {
      const brand = name.slice(0, -(suffix.length + 1)).split(".").pop();
      return brand ? `${brand}.${suffix}` : name;
    }
  }
  const parts = name.split(".");
  return parts.length <= 2 ? name : parts.slice(-2).join(".");
};
