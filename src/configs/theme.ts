/**
 * Theme Configuration System
 *
 * This file provides dynamic color theme variants for the application.
 * Users can switch between different color schemes using the ThemeSelector component.
 *
 * Available Variants:
 * - Ocean Blue: Professional & Trustworthy (blue/cyan tones)
 * - Forest Green: Natural & Calm (green/teal tones)
 * - 2keevo Indigo: matches the 2keevo website - DEFAULT
 *
 * Each variant includes:
 * - Light and dark mode colors
 * - Primary, secondary colors
 * - Gradient for UI elements
 *
 * The theme can be changed dynamically via:
 * 1. ThemeSelector component in the header
 * 2. Or programmatically using the useThemeVariant hook
 */

// Color variants configuration
export const colorVariants = {
  ocean: {
    name: "Ocean Blue",
    description: "Professional & Trustworthy",
    light: {
      primary: "#0EA5E9",
      secondary_1: "#06B6D4",
      secondary_2: "#14B8A6",
    },
    dark: {
      primary: "#38BDF8",
      secondary_1: "#22D3EE",
      secondary_2: "#2DD4BF",
    },
    gradient: "linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)",
  },
  forest: {
    name: "Forest Green",
    description: "Natural & Calm",
    light: {
      primary: "#10B981",
      secondary_1: "#059669",
      secondary_2: "#14B8A6",
    },
    dark: {
      primary: "#34D399",
      secondary_1: "#10B981",
      secondary_2: "#2DD4BF",
    },
    gradient: "linear-gradient(135deg, #10B981 0%, #14B8A6 100%)",
  },
  // Matches the 2keevo website (notes_web): indigo and lilac.
  purple: {
    name: "2keevo Indigo",
    description: "Matches the 2keevo website",
    light: {
      primary: "#5b4fc4",
      secondary_1: "#7d6fe0",
      secondary_2: "#b9a8ff",
    },
    dark: {
      primary: "#7d6ce6",
      secondary_1: "#b9a8ff",
      secondary_2: "#d9cfff",
    },
    gradient: "linear-gradient(135deg, #5b4fc4 0%, #b9a8ff 100%)",
  },
};

// Get theme config based on variant
export const getThemeConfig = (
  variant: keyof typeof colorVariants = "purple"
) => {
  const colors = colorVariants[variant];

  const components = {
    Button: {
      borderRadius: 10,
      borderRadiusLG: 10,
      borderRadiusSM: 10,
    },
  };

  // Shared by light and dark. Same key-tag colours as the website.
  const shared = {
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontFamilyCode: "'JetBrains Mono', ui-monospace, monospace",
    borderRadius: 12,
    fontSize: 14,
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
        colorSuccess: "#2f9e6e",
        colorWarning: "#e8a33c",
        colorError: "#d64562",
        colorInfo: "#3d6fd6",
        colorBgLayout: "#eeecf6",
        colorBgContainer: "#fbfaff",
        colorBgElevated: "#ffffff",
        colorText: "#18192f",
        colorTextSecondary: "#565876",
        colorTextPlaceholder: "#8a8ca8",
        colorBorder: "#d9d7e8",
        colorBorderSecondary: "#e6e4f0",
        boxShadow: "0 1px 3px rgba(24, 25, 47, 0.08), 0 1px 2px -1px rgba(24, 25, 47, 0.08)",
        colorBgMenu: "#fbfaff",
        colorTextMenu: "#18192f",
        colorBgMenuItem: "#f4f2fb",
        colorPrimaryBg: "#ece9f9",
        colorPrimaryBgHover: "#e0dcf6",
        surfaceCard: "#fbfaff",
        surfaceMuted: "#f4f2fb",
        surfaceHover: "#ece9f9",
        textMuted: "#5f6182",
        iconMuted: "#8a8ca8",
        borderSubtle: "rgba(24, 25, 47, 0.1)",
        customFieldBg: "#f4f2fb",
        customFieldRowBg: "#f4f2fb",
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
        colorSuccess: "#5fc99a",
        colorWarning: "#f0b65c",
        colorError: "#f07a92",
        colorInfo: "#8cb4ff",
        colorBgLayout: "#161834",
        colorBgContainer: "#1e2147",
        colorBgElevated: "#292d5c",
        colorText: "#f4f2ea",
        colorTextSecondary: "#b3b4d4",
        colorTextTertiary: "#c9c9e2",
        colorTextQuaternary: "#9a9cc4",
        colorTextPlaceholder: "#9a9cc4",
        colorIcon: "#d6d5ea",
        colorBorder: "#3a3e72",
        colorBorderSecondary: "#2f3364",
        boxShadow: "0 4px 12px rgba(6, 7, 26, 0.45)",
        colorBgMenu: "#1e2147",
        colorTextMenu: "#f4f2ea",
        colorBgMenuItem: "#161834",
        colorPrimaryBg: "#2f2a6b",
        colorPrimaryBgHover: "#3a3482",
        surfaceCard: "#1e2147",
        surfaceMuted: "rgba(232, 229, 255, 0.06)",
        surfaceHover: "rgba(232, 229, 255, 0.1)",
        textMuted: "#b3b4d4",
        iconMuted: "#9a9cc4",
        borderSubtle: "rgba(232, 229, 255, 0.12)",
        customFieldBg: "rgba(232, 229, 255, 0.06)",
        customFieldRowBg: "#1e2147",
      },
    },
  };
};

// Default theme configs (purple variant)
export const themesConfigs = getThemeConfig("purple");
