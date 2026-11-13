"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Field } from "@/components/ui";
import type { Effective } from "@/lib/permissions";
import { VIS_HELP, VIS_ICON, VIS_LABEL } from "@/lib/visibility-labels";

type Limits = { maxFileMb: number; inviteDays: number; trashDays: number };

/** Admin › ตั้งค่า (ui-design §7.12): ชื่อ Workspace · ภาษา · ค่าเริ่มต้นสิทธิ์ (D15) · ข้อจำกัดระบบแบบอ่านอย่างเดียว */
export function SettingsClient({ initial, limits }: { initial: { name: string; defaultVisibility: Effective; language: string }; limits: Limits }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [name, setName] = useState(initial.name);
  const [vis, setVis] = useState<Effective>(initial.defaultVisibility);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const dirty = name.trim() !== initial.name || vis !== initial.defaultVisibility;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk(false);
    const r = await api("/api/v1/admin/settings", "PATCH", { name, defaultVisibility: vis });
    setBusy(false);
    if (!r.ok) return setErr(r.error!);
    setOk(true); router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      <form onSubmit={save} className="space-y-5 rounded-xl border border-line bg-sidebar p-5">
        {err && <Alert>{err}</Alert>}
        {ok && <Alert tone="info">{t("settings.saved")}</Alert>}
        <Field label={t("settings.name")} required maxLength={80} value={name} onChange={(e) => { setName(e.target.value); setOk(false); }} />
        <div className="space-y-1.5">
          <label htmlFor="lang" className="text-[13px] font-semibold text-muted">{t("settings.language")}</label>
          <input id="lang" readOnly value={t(`lang.${locale}`)} className="min-h-11 w-full rounded-[10px] border border-line bg-sidebar px-3 text-muted" />
          <p className="text-xs text-muted">{t("settings.languageHint")}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold text-muted">{t("settings.defaultVis")}</legend>
          {(["private", "workspace_view", "workspace_edit"] as const).map((o) => (
            <label key={o} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 ${vis === o ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover"}`}>
              <input type="radio" name="vis" checked={vis === o} onChange={() => { setVis(o); setOk(false); }} className="mt-1 accent-[var(--accent)]" />
              <span><span className="text-sm font-medium">{VIS_ICON[o]} {t(VIS_LABEL[o])}</span><span className="block text-xs text-muted">{t(VIS_HELP[o])}</span></span>
            </label>
          ))}
          <p className="text-xs text-muted">{t("settings.defaultVisNote")}</p>
        </fieldset>
        <div className="flex justify-end"><Button type="submit" disabled={busy || !dirty || !name.trim()}>{t("common.save")}</Button></div>
      </form>

      <section aria-labelledby="lim" className="rounded-xl border border-line bg-sidebar p-5">
        <h2 id="lim" className="mb-2 text-[13px] font-semibold text-muted">{t("settings.limits")}</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
          <dt className="text-text-2">{t("settings.fileSize")}</dt><dd className="font-mono text-text">{t("settings.perFile", { n: limits.maxFileMb })}</dd>
          <dt className="text-text-2">{t("settings.inviteAge")}</dt><dd className="font-mono text-text">{t("settings.days", { n: limits.inviteDays })}</dd>
          <dt className="text-text-2">{t("settings.trashKeep")}</dt><dd className="font-mono text-text">{t("settings.daysThenPurge", { n: limits.trashDays })}</dd>
        </dl>
      </section>
    </div>
  );
}
