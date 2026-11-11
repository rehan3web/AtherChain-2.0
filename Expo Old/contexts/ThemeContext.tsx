import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  const theme: ThemeMode = override ?? (systemScheme === "light" ? "light" : "dark");

  const toggleTheme = () => {
    setOverride((prev) => {
      if (prev === null) return systemScheme === "light" ? "dark" : "light";
      return prev === "light" ? "dark" : "light";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
