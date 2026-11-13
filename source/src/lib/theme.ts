/** ธีมสี (pure — ใช้ได้ทั้ง server และ client) */
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "di-theme";

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}
export function toTheme(v: unknown): Theme {
  return isTheme(v) ? v : DEFAULT_THEME;
}
