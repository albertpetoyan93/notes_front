import React, { createContext, useContext, useState } from "react";
import { themesConfigs } from "../configs/theme";

// Define the shape of the context value
interface ThemeContextProps {
  theme: any;
  mode: keyof typeof themesConfigs;
  handleThemeChange: (newTheme: keyof typeof themesConfigs) => void;
}

// Create the context
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

// Provide the context
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<keyof typeof themesConfigs>(() => {
    const storedTheme = localStorage.getItem(
      "theme"
    ) as keyof typeof themesConfigs;
    return themesConfigs[storedTheme] ? storedTheme : "light";
  });

  const handleThemeChange = (newTheme: keyof typeof themesConfigs) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode: theme,
        theme: themesConfigs[theme],
        handleThemeChange,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
