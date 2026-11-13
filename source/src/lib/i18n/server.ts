import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, toLocale, type Locale } from "./locales";
import { translate, type MsgKey } from "./messages";

/** ภาษาของ request นี้: ผู้ที่ login ใช้ค่าที่บันทึกไว้ในบัญชี, ผู้ที่ยังไม่ login ใช้ cookie, ไม่มีเลย = ไทย */
export async function getLocale(): Promise<Locale> {
  const u = await getSessionUser();
  if (u) return u.locale;
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/** ฟังก์ชันแปลสำหรับ server component */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: MsgKey, params?: Record<string, string | number>) => translate(locale, key, params) };
}
