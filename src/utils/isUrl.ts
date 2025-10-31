// Utility function to check if a value is a URL
export const isURL = (value: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    // Try with http:// prefix if it looks like a URL
    if (value.includes(".") && !value.includes(" ")) {
      try {
        new URL(`http://${value}`);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
};
