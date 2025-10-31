/**
 * Theme Configuration System
 *
 * This file provides dynamic color theme variants for the application.
 * Users can switch between different color schemes using the ThemeSelector component.
 *
 * Available Variants:
 * - Ocean Blue: Professional & Trustworthy (blue/cyan tones)
 * - Sunset Orange: Energetic & Creative (orange/amber tones)
 * - Forest Green: Natural & Calm (green/teal tones)
 * - Royal Purple: Elegant & Luxurious (violet/purple tones) - DEFAULT
 * - Coral Pink: Modern & Playful (pink/rose tones)
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

const white = "#ffffff";

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
  purple: {
    name: "Royal Purple",
    description: "Elegant & Luxurious",
    light: {
      primary: "#8B5CF6",
      secondary_1: "#A78BFA",
      secondary_2: "#C084FC",
    },
    dark: {
      primary: "#A78BFA",
      secondary_1: "#C4B5FD",
      secondary_2: "#DDD6FE",
    },
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #C084FC 100%)",
  },
};

// Get theme config based on variant
export const getThemeConfig = (
  variant: keyof typeof colorVariants = "purple"
) => {
  const colors = colorVariants[variant];

  return {
    light: {
      token: {
        primary: colors.light.primary,
        secondary_1: colors.light.secondary_1,
        secondary_2: colors.light.secondary_2,
        //
        colorPrimary: colors.light.primary,
        colorSuccess: "#10B981",
        colorWarning: "#F59E0B",
        colorError: "#EF4444",
        colorInfo: "#3B82F6",
        colorBgContainer: white,
        colorBgLayout: "#b5c2ca",
        colorBgElevated: white,
        colorText: "#1F2937",
        colorTextSecondary: "#6B7280",
        colorBorder: "#E5E7EB",
        borderRadius: 12,
        fontSize: 14,
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        colorBgMenu: "#FFFFFF",
        colorTextMenu: "#1F2937",
        colorBgMenuItem: "#F9FAFB",
        colorPrimaryBg: "#F3F4F6",
        colorPrimaryBgHover: "#E5E7EB",
        surfaceCard: "rgba(255, 255, 255, 0.98)",
        surfaceMuted: "#F8FAFC",
        surfaceHover: "#EEF2FF",
        textMuted: "#64748B",
        iconMuted: "#94A3B8",
        borderSubtle: "rgba(15, 23, 42, 0.08)",
        customFieldBg: "#e5e8ed",
        customFieldRowBg: "#e5e8ed",
      },
    },
    dark: {
      token: {
        primary: colors.dark.primary,
        secondary_1: colors.dark.secondary_1,
        secondary_2: colors.dark.secondary_2,
        colorPrimary: colors.dark.primary,
        colorSuccess: "#34D399",
        colorWarning: "#FBBF24",
        colorError: "#F87171",
        colorInfo: "#60A5FA",
        colorBgContainer: "#1F2937",
        colorBgElevated: "#111827",
        colorBgLayout: "#111827",
        colorTextSecondary: "#9CA3AF",
        colorTextTertiary: "#D1D5DB",
        colorIcon: "#E5E7EB",
        colorText: "#F9FAFB",
        colorBorder: "#374151",
        borderRadius: 12,
        fontSize: 14,
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
        colorBgMenu: "#1F2937",
        colorTextMenu: "#F9FAFB",
        colorBgMenuItem: "#111827",
        colorPrimaryBg: "#312E81",
        colorPrimaryBgHover: "#3730A3",
        surfaceCard: "#111827",
        surfaceMuted: "rgba(148, 163, 184, 0.12)",
        surfaceHover: "rgba(148, 163, 184, 0.2)",
        textMuted: "#94A3B8",
        iconMuted: "#94A3B8",
        borderSubtle: "rgba(148, 163, 184, 0.18)",
        customFieldBg: "rgba(148, 163, 184, 0.12)",
        customFieldRowBg: "#1F2937",
      },
    },
  };
};

// Default theme configs (purple variant)
export const themesConfigs = getThemeConfig("purple");
