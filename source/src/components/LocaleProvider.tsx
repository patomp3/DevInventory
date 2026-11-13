"use client";
import { createContext, useCallback, useContext } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { translate, type MsgKey } from "@/lib/i18n/messages";

const Ctx = createContext<Locale>("th");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  return useContext(Ctx);
}

/** ฟังก์ชันแปลสำหรับ client component: const t = useT(); t("nav.home") */
export function useT() {
  const locale = useContext(Ctx);
  return useCallback((key: MsgKey, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
}
