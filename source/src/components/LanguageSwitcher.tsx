"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { LOCALES, type Locale } from "@/lib/i18n/locales";

/** ธงชาติแบบ SVG (emoji ธงแสดงเป็นตัวอักษรบน Windows จึงไม่ใช้): ไทย = ธงไตรรงค์, อังกฤษ = ธงสหราชอาณาจักร */
function Flag({ locale }: { locale: Locale }) {
  const uid = useId();
  if (locale === "th") {
    return (
      <svg viewBox="0 0 30 20" width="20" height="13" aria-hidden className="block rounded-[2px]">
        <rect width="30" height="20" fill="#A51931" />
        <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
        <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 40" width="20" height="13" aria-hidden className="block rounded-[2px]" preserveAspectRatio="none">
      <clipPath id={`${uid}s`}><path d="M0,0 H60 V40 H0 z" /></clipPath>
      <clipPath id={`${uid}t`}><path d="M30,20 H60 V40 z M30,20 V40 H0 z M30,20 H0 V0 z M30,20 V0 H60 z" /></clipPath>
      <g clipPath={`url(#${uid}s)`}>
        <path d="M0,0 H60 V40 H0 z" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
        <path d="M0,0 L60,40 M60,0 L0,40" clipPath={`url(#${uid}t)`} stroke="#C8102E" strokeWidth="5" />
        <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="13" />
        <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="8" />
      </g>
    </svg>
  );
}

/** เมนูเปลี่ยนภาษา (ธงชาติ): บันทึกลงบัญชีผู้ใช้ (PUT /api/v1/me/locale) แล้วโหลดหน้าใหม่ด้วยภาษาที่เลือก */
export function LanguageSwitcher() {
  const current = useLocale();
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function choose(locale: Locale) {
    if (locale === current || busy) return;
    setBusy(true); setErr(false);
    try {
      const r = await fetch("/api/v1/me/locale", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale }) });
      if (!r.ok) throw new Error(String(r.status));
      router.refresh();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div role="group" aria-label={t("lang.label")} className="inline-flex gap-0.5">
        {LOCALES.map((l) => (
          <button key={l} type="button" onClick={() => choose(l)} disabled={busy} aria-pressed={l === current} lang={l}
            title={t(`lang.${l}`)} aria-label={t(`lang.${l}`)}
            className={`flex items-center rounded border p-[3px] ${l === current ? "border-accent bg-accent-soft" : "border-transparent opacity-55 hover:bg-surface-hover hover:opacity-100"}`}>
            <Flag locale={l} />
          </button>
        ))}
      </div>
      {err && <span role="alert" className="text-[11px] text-red-300">{t("lang.saveFailed")}</span>}
    </div>
  );
}
