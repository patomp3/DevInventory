"use client";
import { createContext, useContext } from "react";
import type { Theme } from "@/lib/theme";

const Ctx = createContext<Theme>("dark");

/** ธีมของ request นี้ (จาก root layout) — ให้ปุ่มธีมรู้สถานะเริ่มต้นตรงกับ HTML ที่ server ส่ง */
export function ThemeProvider({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
