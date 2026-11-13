import { toLocale } from "./locales";
import { translate, type MsgKey } from "./messages";

/** แปลในโค้ด client ที่ไม่ใช่ hook (เช่น ฟังก์ชัน fetch): อ่านภาษาจาก <html lang> ที่ root layout ตั้งไว้ตามบัญชีผู้ใช้ */
export function tNow(key: MsgKey, params?: Record<string, string | number>): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return translate(toLocale(lang), key, params);
}
