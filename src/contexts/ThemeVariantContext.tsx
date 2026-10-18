import React, { createContext, useContext, useState, ReactNode } from "react";
import { colorVariants, type ThemeVariant } from "../configs/theme";

interface ThemeVariantContextType {
  variant: ThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
  gradientStyle: string;
}

const ThemeVariantContext = createContext<ThemeVariantContextType | undefined>(
  undefined
);

// Older builds offered other colour variants; anything no longer listed falls back to the brand one.
const savedVariant = (): ThemeVariant => {
  const saved = localStorage.getItem("themeVariant");
  return saved && saved in colorVariants ? (saved as ThemeVariant) : "purple";
};

export const ThemeVariantProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [variant, setVariantState] = useState<ThemeVariant>(savedVariant);

  const setVariant = (newVariant: ThemeVariant) => {
    setVariantState(newVariant);
    localStorage.setItem("themeVariant", newVariant);
  };

  const gradientStyle = colorVariants[variant].gradient;

  return (
    <ThemeVariantContext.Provider
      value={{ variant, setVariant, gradientStyle }}
    >
      {children}
    </ThemeVariantContext.Provider>
  );
};

export const useThemeVariant = () => {
  const context = useContext(ThemeVariantContext);
  if (!context) {
    throw new Error("useThemeVariant must be used within ThemeVariantProvider");
  }
  return context;
};
