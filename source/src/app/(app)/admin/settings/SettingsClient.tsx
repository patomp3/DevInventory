"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Field } from "@/components/ui";
import type { Effective } from "@/lib/permissions";
import { VIS_HELP, VIS_ICON, VIS_LABEL } from "@/lib/visibility-labels";

type Limits = { maxFileMb: number; inviteDays: number; trashDays: number };

/** Admin › ตั้งค่า (ui-design §7.12): ชื่อ Workspace · ภาษา · ค่าเริ่มต้นสิทธิ์ (D15) · ข้อจำกัดระบบแบบอ่านอย่างเดียว */
export function SettingsClient({ initial, limits }: { initial: { name: string; defaultVisibility: Effective; language: string }; limits: Limits }) {
  const router = useRouter();
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
      <h1 className="text-2xl font-semibold">ตั้งค่า Workspace</h1>
      <form onSubmit={save} className="space-y-5 rounded-xl border border-line bg-sidebar p-5">
        {err && <Alert>{err}</Alert>}
        {ok && <Alert tone="info">บันทึกแล้ว</Alert>}
        <Field label="ชื่อ Workspace" required maxLength={80} value={name} onChange={(e) => { setName(e.target.value); setOk(false); }} />
        <div className="space-y-1.5">
          <label htmlFor="lang" className="text-[13px] font-semibold text-muted">ภาษา</label>
          <input id="lang" readOnly value="ไทย" className="min-h-11 w-full rounded-[10px] border border-line bg-sidebar px-3 text-muted" />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold text-muted">ค่าเริ่มต้นของสิทธิ์ (Collection ระดับบนสุดใหม่ และรายการใน Inbox)</legend>
          {(["private", "workspace_view", "workspace_edit"] as const).map((o) => (
            <label key={o} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 ${vis === o ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover"}`}>
              <input type="radio" name="vis" checked={vis === o} onChange={() => { setVis(o); setOk(false); }} className="mt-1 accent-[var(--accent)]" />
              <span><span className="text-sm font-medium">{VIS_ICON[o]} {VIS_LABEL[o]}</span><span className="block text-xs text-muted">{VIS_HELP[o]}</span></span>
            </label>
          ))}
          <p className="text-xs text-muted">มีผลกับรายการ/Collection ที่สร้างหลังจากนี้ ไม่เปลี่ยนสิทธิ์ของที่มีอยู่แล้ว</p>
        </fieldset>
        <div className="flex justify-end"><Button type="submit" disabled={busy || !dirty || !name.trim()}>บันทึก</Button></div>
      </form>

      <section aria-labelledby="lim" className="rounded-xl border border-line bg-sidebar p-5">
        <h2 id="lim" className="mb-2 text-[13px] font-semibold text-muted">ข้อจำกัดระบบ (อ่านอย่างเดียว)</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
          <dt className="text-text-2">ขนาดไฟล์แนบ</dt><dd className="font-mono text-text">{limits.maxFileMb} MB ต่อไฟล์</dd>
          <dt className="text-text-2">อายุคำเชิญ</dt><dd className="font-mono text-text">{limits.inviteDays} วัน</dd>
          <dt className="text-text-2">ถังขยะเก็บไว้</dt><dd className="font-mono text-text">{limits.trashDays} วัน แล้วลบถาวร</dd>
        </dl>
      </section>
    </div>
  );
}
