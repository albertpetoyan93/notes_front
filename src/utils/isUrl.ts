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

// Opens a saved URL in a new tab, adding http:// when it has no scheme.
export const openURL = (value: unknown) => {
  const text = String(value);
  const url = /^https?:\/\//.test(text) ? text : `http://${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
