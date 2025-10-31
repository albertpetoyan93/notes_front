import React, { createContext, useContext, useState, ReactNode } from "react";
import { colorVariants } from "../configs/theme";

type ThemeVariant = keyof typeof colorVariants;

interface ThemeVariantContextType {
  variant: ThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
  gradientStyle: string;
}

const ThemeVariantContext = createContext<ThemeVariantContextType | undefined>(
  undefined
);

export const ThemeVariantProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [variant, setVariantState] = useState<ThemeVariant>(() => {
    const saved = localStorage.getItem("themeVariant");
    return (saved as ThemeVariant) || "purple";
  });

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
