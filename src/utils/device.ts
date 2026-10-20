// "Chrome on Windows" from a user-agent string. Good enough to recognise your own devices.
export const browserAndOs = (userAgent?: string | null) => {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || "";
};

export const isPhoneAgent = (userAgent?: string | null) =>
  /iPhone|iPad|Android/.test(userAgent || "");
