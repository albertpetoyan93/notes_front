import { ConfigProvider } from "antd";
import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import {
  ThemeVariantProvider,
  useThemeVariant,
} from "./contexts/ThemeVariantContext";
import { getThemeConfig } from "./configs/theme";
import AppRoutes from "./routes";

function AppContent() {
  const { mode } = useTheme();
  const { variant } = useThemeVariant();

  const themeConfig = getThemeConfig(variant);
  const theme = mode === "dark" ? themeConfig.dark : themeConfig.light;

  useEffect(() => {
    const root = document.documentElement;
    Object.keys(theme.token).forEach((key) => {
      root.style.setProperty(`--${key}`, (theme.token as any)[key]);
    });
  }, [theme]);

  return (
    <ConfigProvider theme={theme}>
      <BrowserRouter basename={import.meta.env.VITE_APP_BASE_NAME}>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ThemeVariantProvider>
        <AppContent />
      </ThemeVariantProvider>
    </ThemeProvider>
  );
}

export default App;
