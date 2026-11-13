"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Dialog } from "@/components/ui";

/** กู้เวอร์ชัน: ยืนยันก่อน แล้วสร้างเป็นเวอร์ชันใหม่ (ประวัติเดิมอยู่ครบ) */
export function RestoreButton({ itemId, version, currentVersion }: { itemId: string; version: number; currentVersion: number }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function restore() {
    setBusy(true); setErr("");
    const r = await api(`/api/v1/items/${itemId}/versions/${version}/restore`, "POST", { version: currentVersion });
    if (r.ok) { router.push(`/i/${itemId}`); router.refresh(); return; }
    setErr(r.status === 409 ? t("hist.conflict") : r.error!);
    setBusy(false);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t("hist.restoreBtn")}</Button>
      {open && (
        <Dialog title={t("hist.restoreTitle", { v: version })} onClose={() => !busy && setOpen(false)} width={480}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <p className="text-sm text-text-2">{t("hist.restoreBody1", { v: version })} <b>{t("hist.versionN", { v: currentVersion + 1 })}</b> {t("hist.restoreBody2")}</p>
            <p className="text-xs text-muted">{t("hist.restoreNote")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>{t("common.cancel")}</Button>
              <Button onClick={restore} disabled={busy}>{t("hist.restoreBtn")}</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
