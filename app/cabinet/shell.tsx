"use client";

import { createContext, useContext, useOptimistic, type ReactNode } from "react";
import type { ThemeChange, ThemePreferences } from "../../lib/theme";

const ThemeContext = createContext<{
  theme: ThemePreferences;
  previewTheme: (change: ThemeChange) => void;
} | null>(null);

export function useCabinetTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("Theme settings require a cabinet shell.");
  return value;
}

export function CabinetShell({ preferences, children }: { preferences: ThemePreferences; children: ReactNode }) {
  const [theme, previewTheme] = useOptimistic(preferences, (current, change: ThemeChange) => ({ ...current, ...change }));

  return <ThemeContext.Provider value={{ theme, previewTheme }}>
    <div className="shell" data-mode={theme.mode} data-palette={theme.palette}>{children}</div>
  </ThemeContext.Provider>;
}
