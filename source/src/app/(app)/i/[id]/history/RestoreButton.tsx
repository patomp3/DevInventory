"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Dialog } from "@/components/ui";

/** กู้เวอร์ชัน: ยืนยันก่อน แล้วสร้างเป็นเวอร์ชันใหม่ (ประวัติเดิมอยู่ครบ) */
export function RestoreButton({ itemId, version, currentVersion }: { itemId: string; version: number; currentVersion: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function restore() {
    setBusy(true); setErr("");
    const r = await api(`/api/v1/items/${itemId}/versions/${version}/restore`, "POST", { version: currentVersion });
    if (r.ok) { router.push(`/i/${itemId}`); router.refresh(); return; }
    setErr(r.status === 409 ? "มีคนแก้ไขรายการนี้ไปก่อนแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่" : r.error!);
    setBusy(false);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>กู้เวอร์ชันนี้</Button>
      {open && (
        <Dialog title={`กู้เวอร์ชัน ${version}`} onClose={() => !busy && setOpen(false)} width={480}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <p className="text-sm text-text-2">ชื่อ เนื้อหา ป้าย และ tag ของเวอร์ชัน {version} จะถูกบันทึกเป็น <b>เวอร์ชัน {currentVersion + 1}</b> ใหม่ ประวัติเดิมทุกเวอร์ชันยังอยู่ครบ</p>
            <p className="text-xs text-muted">ไม่กระทบสิทธิ์ Collection หรือไฟล์แนบ</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>ยกเลิก</Button>
              <Button onClick={restore} disabled={busy}>กู้เวอร์ชันนี้</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
