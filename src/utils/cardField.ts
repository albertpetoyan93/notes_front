export const CARD_BRANDS = [
  "Visa",
  "Mastercard",
  "Discover",
  "ArCa",
  "MIR",
  "American Express",
] as const;

export function cardFieldKind(label?: string) {
  const name = String(label || "").trim().toLowerCase();
  if (name === "number") return "number" as const;
  if (name === "expires") return "expires" as const;
  if (name === "cvv") return "cvv" as const;
  if (name === "brand") return "brand" as const;
  return null;
}

export function isAmexBrand(brand?: string) {
  const name = String(brand || "").trim().toLowerCase();
  return name.includes("amex") || name.includes("american express");
}

export function cardBrandFromFields(fields: { label?: string; value?: string }[]) {
  const brand = fields.find((field) => cardFieldKind(field.label) === "brand");
  return String(brand?.value || "");
}

export function formatCardNumber(value: string, brand = "") {
  const amex = isAmexBrand(brand);
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, amex ? 15 : 16);
  if (!amex) return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]
    .filter(Boolean)
    .join(" ");
}

export function formatExpiry(value: string, previous = "") {
  const next = String(value || "");
  let digits = next.replace(/\D/g, "").slice(0, 4);
  if (previous.endsWith("/") && next === previous.slice(0, -1)) {
    digits = digits.slice(0, -1);
  }
  if (!digits) return "";
  if (digits.length === 1) {
    return Number(digits) > 1 ? `0${digits}/` : digits;
  }
  let month = digits.slice(0, 2);
  const monthNumber = Number(month);
  if (monthNumber === 0) month = "01";
  else if (monthNumber > 12) month = "12";
  const year = digits.slice(2, 4);
  return year ? `${month}/${year}` : `${month}/`;
}

export function cardNumberPlaceholder(brand = "") {
  if (!String(brand).trim()) return "Card number";
  return isAmexBrand(brand) ? "1234 567890 12345" : "1234 5678 9012 3456";
}

export function cvvPlaceholder(brand = "") {
  if (!String(brand).trim()) return "CVV";
  return isAmexBrand(brand) ? "1234" : "123";
}

export function formatCvv(value: string, brand = "") {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, isAmexBrand(brand) ? 4 : 3);
}

export function formatCardField(
  label: string,
  value: string,
  previous = "",
  brand = ""
) {
  const kind = cardFieldKind(label);
  if (kind === "number") return formatCardNumber(value, brand);
  if (kind === "expires") return formatExpiry(value, previous);
  if (kind === "cvv") return formatCvv(value, brand);
  return value;
}
