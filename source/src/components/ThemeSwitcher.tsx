"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type Theme } from "@/lib/theme";

const Icon = ({ theme }: { theme: Theme }) =>
  theme === "dark" ? (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );

/** ปุ่มเลือกธีม (พระจันทร์ = มืด, ดวงอาทิตย์ = สว่าง): ใช้ทันทีแล้วบันทึกลงบัญชี (PUT /api/v1/me/theme) */
export function ThemeSwitcher() {
  const t = useT();
  const router = useRouter();
  const serverTheme = useTheme();
  const [override, setOverride] = useState<Theme | null>(null); // ค่าที่เพิ่งกดและยังรอ server ยืนยัน
  const current = override ?? serverTheme;
  useEffect(() => setOverride(null), [serverTheme]);
  const [err, setErr] = useState(false);

  async function choose(theme: Theme) {
    if (theme === current) return;
    const prev = current;
    setOverride(theme); setErr(false);
    document.documentElement.dataset.theme = theme; // เห็นผลทันที ไม่ต้องรอเซิร์ฟเวอร์
    try {
      const r = await fetch("/api/v1/me/theme", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme }) });
      if (!r.ok) throw new Error(String(r.status));
      router.refresh();
    } catch {
      setOverride(null); document.documentElement.dataset.theme = prev; setErr(true);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div role="group" aria-label={t("theme.label")} className="inline-flex gap-0.5">
        {THEMES.map((th) => (
          <button key={th} type="button" onClick={() => choose(th)} aria-pressed={th === current}
            title={t(`theme.${th}`)} aria-label={t(`theme.${th}`)}
            className={`flex items-center rounded border p-[3px] ${th === current ? "border-accent bg-accent-soft text-accent" : "border-transparent text-muted hover:bg-surface-hover hover:text-text"}`}>
            <Icon theme={th} />
          </button>
        ))}
      </div>
      {err && <span role="alert" className="text-[11px] text-red-300">{t("theme.saveFailed")}</span>}
    </div>
  );
}
