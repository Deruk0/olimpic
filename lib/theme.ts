export const themeModes = {
  light: "Светлый",
  dark: "Тёмный",
} as const;

export const themePalettes = {
  purple: "Фиолетовая",
  blue: "Синяя",
  turquoise: "Бирюзовая",
} as const;

export type ThemeMode = keyof typeof themeModes;
export type ThemePalette = keyof typeof themePalettes;
export type ThemePreferences = { mode: ThemeMode; palette: ThemePalette };
export type ThemeChange = { mode: ThemeMode } | { palette: ThemePalette };

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && Object.hasOwn(themeModes, value);
}

export function isThemePalette(value: unknown): value is ThemePalette {
  return typeof value === "string" && Object.hasOwn(themePalettes, value);
}
