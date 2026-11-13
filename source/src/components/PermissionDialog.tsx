"use client";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { tNow } from "@/lib/i18n/client";
import type { MsgKey } from "@/lib/i18n/messages";
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
  const t = useT();
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
          <legend className="sr-only">{t("vis.level")}</legend>
          {opts.map((o) => (
            <label key={o} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 ${value === o ? "border-accent bg-accent-soft" : "border-line"}`}>
              <input type="radio" name="vis" className="mt-1" checked={value === o} onChange={() => setValue(o)} />
              <span>
                <span className="text-sm font-medium"><span aria-hidden>{VIS_ICON[o]}</span> {t(VIS_LABEL[o])}</span>
                <span className="block text-xs text-muted">{o === "inherit" ? t("vis.inheritHelp") : t(VIS_HELP[o])}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {widening && widerWarning && <Alert tone="warn">{widerWarning}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={busy || value === current} onClick={async () => {
            setBusy(true);
            const e = await onSave(value);
            if (e) { setErr(e); setBusy(false); }
          }}>{t("vis.savePerm")}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** รหัส error ที่ API ส่งมา → key ข้อความ (ไม่อยู่ในนี้ = "ดำเนินการไม่สำเร็จ") */
const ERR_CODES = [
  "forbidden", "not_found", "max_depth", "cycle", "not_empty", "top_level_cannot_inherit", "no_parent_to_inherit", "invalid_url",
  "title_required", "validation", "kind_required", "invalid_kind", "body_too_large", "too_many_tags", "invalid_new_owner", "same_owner",
  "owner_active", "cannot_transfer_to_self", "already_current", "version_conflict", "file_too_large", "file_empty", "too_many_attachments",
  "invalid_form", "user_exists", "invite_pending", "last_admin", "cannot_demote_self", "invalid_email",
] as const;

/** ข้อความ error ตามภาษาปัจจุบัน; ไม่รู้จักรหัส = fallback (ค่าเริ่มต้น "ดำเนินการไม่สำเร็จ") */
export function apiError(code: unknown, fallback: MsgKey = "common.failed"): string {
  return (ERR_CODES as readonly unknown[]).includes(code) ? tNow(`err.${code as (typeof ERR_CODES)[number]}`) : tNow(fallback);
}

export async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : apiError(data.error) };
}
