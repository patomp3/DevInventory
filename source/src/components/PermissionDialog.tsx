"use client";
import { useState } from "react";
import { Alert, Button, Dialog } from "@/components/ui";
import type { Effective, Setting } from "@/lib/permissions";
import { VIS_HELP, VIS_ICON, VIS_LABEL } from "@/lib/visibility-labels";

/** ตัวเลือกสิทธิ์ของ Collection หรือรายการ (ui-design §7.6) */
export function PermissionDialog({
  title, current, effective, canInherit, widerWarning, onSave, onClose,
}: {
  title: string; current: Setting; effective: Effective; canInherit: boolean; widerWarning?: string;
  onSave: (v: Setting) => Promise<string | void>; onClose: () => void;
}) {
  const [value, setValue] = useState<Setting>(current);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const opts: Setting[] = [...(canInherit ? (["inherit"] as const) : []), "private", "workspace_view", "workspace_edit"];
  const rank = { private: 0, workspace_view: 1, workspace_edit: 2 } as const;
  const widening = value !== "inherit" && rank[value] > rank[effective];
  return (
    <Dialog title={title} onClose={onClose} width={520}>
      <div className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <fieldset className="space-y-2">
          <legend className="sr-only">ระดับการเข้าถึง</legend>
          {opts.map((o) => (
            <label key={o} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 ${value === o ? "border-accent bg-accent-soft" : "border-line"}`}>
              <input type="radio" name="vis" className="mt-1" checked={value === o} onChange={() => setValue(o)} />
              <span>
                <span className="text-sm font-medium"><span aria-hidden>{VIS_ICON[o]}</span> {VIS_LABEL[o]}</span>
                <span className="block text-xs text-muted">{o === "inherit" ? "ใช้ค่าเดียวกับ Collection แม่ และเปลี่ยนตามอัตโนมัติ" : VIS_HELP[o]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {widening && widerWarning && <Alert tone="warn">{widerWarning}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={busy || value === current} onClick={async () => {
            setBusy(true);
            const e = await onSave(value);
            if (e) { setErr(e); setBusy(false); }
          }}>บันทึกสิทธิ์</Button>
        </div>
      </div>
    </Dialog>
  );
}

export const API_ERR: Record<string, string> = {
  forbidden: "คุณไม่มีสิทธิ์ทำรายการนี้", not_found: "ไม่พบรายการ", max_depth: "Collection ซ้อนได้ไม่เกิน 3 ชั้น", cycle: "ย้ายเข้าไปอยู่ใต้ตัวเองไม่ได้",
  not_empty: "ลบได้เฉพาะ Collection ที่ว่าง (ย้ายหรือลบรายการข้างในก่อน)", top_level_cannot_inherit: "Collection ระดับบนสุดต้องตั้งสิทธิ์เอง",
  no_parent_to_inherit: "รายการใน Inbox ต้องตั้งสิทธิ์เอง", invalid_url: "URL ต้องขึ้นต้นด้วย http:// หรือ https://", title_required: "กรุณาใส่ชื่อเรื่อง",
  validation: "ข้อมูลไม่ถูกต้อง", kind_required: "เลือกป้ายอย่างน้อย 1 ป้าย", invalid_kind: "ป้ายไม่ถูกต้อง",
  body_too_large: "เนื้อหายาวเกินกำหนด (ไม่เกิน 500,000 ตัวอักษร)", too_many_tags: "ใส่ tag ได้ไม่เกิน 20 รายการ",
  already_current: "นี่คือเวอร์ชันปัจจุบันอยู่แล้ว", version_conflict: "มีคนแก้ไขรายการนี้ไปก่อนแล้ว",
  file_too_large: "ไฟล์ใหญ่เกิน 50 MB", file_empty: "ไฟล์ว่างเปล่า", too_many_attachments: "แนบได้ไม่เกิน 50 ไฟล์ต่อรายการ", invalid_form: "ส่งไฟล์ไม่สำเร็จ",
};

export async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : API_ERR[data.error as string] ?? "ดำเนินการไม่สำเร็จ" };
}
