/**
 * Theme configuration.
 *
 * One brand (2keevo indigo) with a light and a dark mode. Every token below is also
 * written to :root as a CSS variable (`--<name>`) by App.tsx, so SCSS reads the same
 * values antd does.
 *
 * Surfaces: `colorBgLayout` is the page, `surfaceSide` the sidebar and top bar,
 * `surfaceCard` panels and cards. Indigo is used only as the accent.
 */

export const colorVariants = {
  purple: {
    name: "2keevo Indigo",
    description: "Matches the 2keevo website",
    light: {
      primary: "#5b4fc4",
      secondary_1: "#7d6fe0",
      secondary_2: "#b9a8ff",
    },
    dark: {
      primary: "#6a5dd8",
      secondary_1: "#b9a8ff",
      secondary_2: "#d9cfff",
    },
    gradient: "linear-gradient(135deg, #5b4fc4 0%, #b9a8ff 100%)",
  },
};

export type ThemeVariant = keyof typeof colorVariants;

const fontFamily = "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const getThemeConfig = (variant: ThemeVariant = "purple") => {
  const colors = colorVariants[variant] || colorVariants.purple;

  const components = {
    Button: {
      borderRadius: 10,
      borderRadiusLG: 12,
      borderRadiusSM: 8,
      controlHeight: 36,
      fontWeight: 500,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
    },
    Input: { borderRadius: 10, controlHeight: 36 },
    InputNumber: { borderRadius: 10, controlHeight: 36 },
    Select: { borderRadius: 10, controlHeight: 36 },
    Modal: { borderRadiusLG: 16 },
    Dropdown: { borderRadiusLG: 12 },
    Tooltip: { borderRadius: 8 },
  };

  // Shared by light and dark. Same key-tag colours as the website.
  const shared = {
    fontFamily,
    fontFamilyDisplay: "'Bricolage Grotesque', 'Geist', system-ui, sans-serif",
    fontFamilyCode: "'JetBrains Mono', ui-monospace, monospace",
    borderRadius: 10,
    fontSize: 14,
    controlHeight: 36,
    catLogin: "#b9a8ff",
    catNote: "#f3d36b",
    catCommand: "#72d6e0",
    catSsh: "#ff9cbc",
    catDb: "#b5e07a",
    catAddress: "#8cc3ff",
    catCard: "#f2b65e",
    catOther: "#cfcbe3",
    healthWeak: "#e2607a",
    healthReused: "#e8a33c",
    healthStale: "#7d84b8",
  };

  return {
    light: {
      components,
      token: {
        ...shared,
        primary: colors.light.primary,
        secondary_1: colors.light.secondary_1,
        secondary_2: colors.light.secondary_2,
        colorPrimary: colors.light.primary,
        colorLink: colors.light.primary,
        colorSuccess: "#2f9e6e",
        colorWarning: "#e8a33c",
        colorError: "#c23a55",
        colorInfo: "#3d6fd6",
        colorBgLayout: "#f7f6f3",
        colorBgContainer: "#ffffff",
        colorBgElevated: "#ffffff",
        colorText: "#18192f",
        colorTextSecondary: "#55577a",
        colorTextPlaceholder: "#8a8ca8",
        colorBorder: "#dcdae3",
        colorBorderSecondary: "#ebe9ef",
        boxShadow: "0 1px 2px rgba(24, 25, 47, 0.06), 0 12px 32px -14px rgba(24, 25, 47, 0.25)",
        colorBgMenu: "#ffffff",
        colorTextMenu: "#18192f",
        colorBgMenuItem: "#f4f3ef",
        colorPrimaryBg: "#eceaf9",
        colorPrimaryBgHover: "#e0dcf6",
        surfaceCard: "#ffffff",
        surfaceSide: "#f1efea",
        surfaceMuted: "#f4f3ef",
        surfaceHover: "rgba(24, 25, 47, 0.05)",
        primarySoft: "rgba(91, 79, 196, 0.11)",
        primaryText: "#4a3fb0",
        textMuted: "#55577a",
        textFaint: "#6e7092",
        iconMuted: "#8a8ca8",
        borderSubtle: "rgba(24, 25, 47, 0.09)",
        borderStrong: "rgba(24, 25, 47, 0.15)",
        warnText: "#9a5a0c",
        warnSoft: "#fbf0dd",
        dangerText: "#b93450",
        dangerSoft: "#fbe8ec",
        staleText: "#4f5590",
        staleSoft: "#eceef8",
        toastBg: "#18192f",
        toastText: "#f4f2ea",
        customFieldBg: "#f4f3ef",
        customFieldRowBg: "#f4f3ef",
      },
    },
    dark: {
      components,
      token: {
        ...shared,
        primary: colors.dark.primary,
        secondary_1: colors.dark.secondary_1,
        secondary_2: colors.dark.secondary_2,
        colorPrimary: colors.dark.primary,
        colorLink: "#b3a9ff",
        colorSuccess: "#5fc99a",
        colorWarning: "#f0b65c",
        colorError: "#f07a92",
        colorInfo: "#8cb4ff",
        colorBgLayout: "#0e0f1d",
        colorBgContainer: "#16182c",
        colorBgElevated: "#1d2036",
        colorText: "#f2f1ec",
        colorTextSecondary: "#a9abc8",
        colorTextTertiary: "#c9c9e2",
        colorTextQuaternary: "#9a9cc4",
        colorTextPlaceholder: "#8e90b2",
        colorIcon: "#d6d5ea",
        colorBorder: "#2e3150",
        colorBorderSecondary: "#24273f",
        boxShadow: "0 16px 40px -14px rgba(0, 0, 0, 0.65)",
        colorBgMenu: "#16182c",
        colorTextMenu: "#f2f1ec",
        colorBgMenuItem: "#111226",
        colorPrimaryBg: "#29265a",
        colorPrimaryBgHover: "#332f6e",
        surfaceCard: "#16182c",
        surfaceSide: "#111226",
        surfaceMuted: "rgba(232, 229, 255, 0.05)",
        surfaceHover: "rgba(232, 229, 255, 0.06)",
        primarySoft: "rgba(106, 93, 216, 0.22)",
        primaryText: "#c3bbff",
        textMuted: "#a9abc8",
        textFaint: "#8e90b2",
        iconMuted: "#8e90b2",
        borderSubtle: "rgba(232, 229, 255, 0.08)",
        borderStrong: "rgba(232, 229, 255, 0.15)",
        warnText: "#f0b65c",
        warnSoft: "rgba(240, 182, 92, 0.12)",
        dangerText: "#f28aa0",
        dangerSoft: "rgba(242, 138, 160, 0.12)",
        staleText: "#b3b9ee",
        staleSoft: "rgba(179, 185, 238, 0.12)",
        toastBg: "#f2f1ec",
        toastText: "#18192f",
        customFieldBg: "rgba(232, 229, 255, 0.05)",
        customFieldRowBg: "#16182c",
      },
    },
  };
};

export const themesConfigs = getThemeConfig("purple");
