/** ภาษาที่รองรับ (pure — ใช้ได้ทั้ง server และ client) */
export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE = "di-locale";
export const LOCALE_LABEL: Record<Locale, string> = { th: "ไทย", en: "English" };
/** locale สำหรับ Intl/toLocaleString (วันที่ ตัวเลข) */
export const DATE_LOCALE: Record<Locale, string> = { th: "th-TH", en: "en-GB" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
export function toLocale(v: unknown): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
