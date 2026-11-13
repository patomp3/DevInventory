import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { THEME_COOKIE, toTheme, type Theme } from "@/lib/theme";

/** ธีมของ request นี้: ผู้ที่ login ใช้ค่าในบัญชี, ผู้ที่ยังไม่ login ใช้ cookie, ไม่มีเลย = dark */
export async function getTheme(): Promise<Theme> {
  const u = await getSessionUser();
  if (u) return u.theme;
  return toTheme((await cookies()).get(THEME_COOKIE)?.value);
}
