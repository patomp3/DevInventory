"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, PermissionDialog } from "@/components/PermissionDialog";
import { Alert, Button, Dialog } from "@/components/ui";
import type { Effective, Setting } from "@/lib/permissions";

type Target = { id: string; name: string; depth: number };

export function ItemActions({ id, canEdit, canManage, visibility, effective, hasCollection, collectionId, targets }: {
  id: string; canEdit: boolean; canManage: boolean; visibility: Setting; effective: Effective; hasCollection: boolean; collectionId: string | null; targets: Target[];
}) {
  const router = useRouter();
  const [dlg, setDlg] = useState<"perm" | "move" | "delete" | null>(null);
  const [err, setErr] = useState("");
  const [dest, setDest] = useState<string>(collectionId ?? "");
  const close = () => { setDlg(null); setErr(""); };
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && <Link href={`/i/${id}/edit`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-110">แก้ไข</Link>}
      {canManage && (
        <>
          <Button variant="secondary" onClick={() => setDlg("perm")}>เปลี่ยนสิทธิ์</Button>
          <Button variant="secondary" onClick={() => setDlg("move")}>ย้าย</Button>
          <Button variant="ghost" className="text-red-300" onClick={() => setDlg("delete")}>ลบ</Button>
        </>
      )}
      {dlg === "perm" && (
        <PermissionDialog title="สิทธิ์ของรายการ" current={visibility} effective={effective} canInherit={hasCollection}
          widerWarning="เปิดกว้างกว่า Collection แม่ได้ แต่ผู้ที่ไม่มีสิทธิ์ดู Collection จะเห็นรายการนี้โดยไม่เห็นชื่อ Collection"
          onClose={close}
          onSave={async (v) => {
            const r = await api(`/api/v1/items/${id}/visibility`, "PATCH", { visibility: v });
            if (!r.ok) return r.error;
            close(); router.refresh();
          }} />
      )}
      {dlg === "move" && (
        <Dialog title="ย้ายรายการ" onClose={close} width={460}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <div className="space-y-1.5">
              <label htmlFor="dest" className="text-[13px] font-semibold text-muted">ปลายทาง</label>
              <select id="dest" value={dest} onChange={(e) => setDest(e.target.value)} className="min-h-11 w-full rounded-[10px] border border-line bg-code px-3">
                <option value="">Inbox (ไม่อยู่ใน Collection)</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{"— ".repeat(t.depth - 1)}{t.name}</option>)}
              </select>
            </div>
            <Alert tone="warn">ถ้ารายการตั้งสิทธิ์ “ตาม Collection” สิทธิ์จะเปลี่ยนตามปลายทาง (Inbox ใช้ค่าเริ่มต้นของทีม) ตรวจสอบก่อนย้าย</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ยกเลิก</Button>
              <Button disabled={dest === (collectionId ?? "")} onClick={async () => {
                const r = await api(`/api/v1/items/${id}/move`, "PATCH", { collectionId: dest || null });
                if (!r.ok) return setErr(r.error!);
                close(); router.refresh();
              }}>ย้าย</Button>
            </div>
          </div>
        </Dialog>
      )}
      {dlg === "delete" && (
        <Dialog title="ลบรายการ" onClose={close} width={460}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <p className="text-sm text-text-2">ย้ายรายการนี้ไปถังขยะ? (หน้าถังขยะสำหรับกู้คืนจะเปิดใช้ในสัปดาห์ 7)</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ยกเลิก</Button>
              <Button variant="danger" onClick={async () => {
                const r = await api(`/api/v1/items/${id}`, "DELETE");
                if (!r.ok) return setErr(r.error!);
                router.push(collectionId ? `/c/${collectionId}` : "/inbox"); router.refresh();
              }}>ลบ</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
