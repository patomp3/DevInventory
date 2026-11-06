"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KindChips } from "@/components/KindChips";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, ConfirmDialog } from "@/components/ui";
import type { Kind } from "@/lib/item-content";

type Row = { id: string; title: string; kinds: Kind[]; ownerName: string; deletedByName: string | null; deletedAt: string; daysLeft: number };

/** หน้าถังขยะ (ui-design §1.1): ชื่อ · ป้าย · ลบโดย · ลบเมื่อ · "เหลืออีก N วัน" · กู้คืน / ลบถาวร (ยืนยันก่อน) */
export function TrashClient({ rows, days, isAdmin }: { rows: Row[]; days: number; isAdmin: boolean }) {
  const router = useRouter();
  const [purge, setPurge] = useState<Row | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  async function restore(r: Row) {
    setBusy(r.id); setErr(""); setNote("");
    const res = await api(`/api/v1/items/${r.id}/restore`, "POST");
    setBusy("");
    if (!res.ok) return setErr(res.error!);
    if (res.data.movedToInbox) setNote(`กู้ “${r.title}” แล้ว — Collection เดิมถูกลบไปแล้ว รายการจึงอยู่ใน Inbox`);
    else setNote(`กู้ “${r.title}” แล้ว`);
    router.refresh();
  }

  async function doPurge() {
    if (!purge) return;
    setBusy(purge.id); setErr("");
    const res = await api(`/api/v1/trash/${purge.id}`, "DELETE");
    setBusy("");
    if (!res.ok) return setErr(res.error!);
    setPurge(null);
    router.refresh();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">ถังขยะ</h1>
        <p className="mt-1 text-sm text-muted">
          รายการที่ลบจะอยู่ที่นี่ {days} วัน แล้วถูกลบถาวรอัตโนมัติ (รวมไฟล์แนบ) · เจ้าของเห็นของตัวเอง
          {isAdmin && " · Admin เห็นของทุกคนเฉพาะที่ไม่ใช่รายการส่วนตัว"}
        </p>
      </div>
      {err && <Alert>{err}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">ถังขยะว่างเปล่า</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">รายการในถังขยะ</caption>
            <thead className="bg-sidebar text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">ชื่อเรื่อง</th><th className="px-4 py-2.5 font-semibold">ป้าย</th>
                <th className="px-4 py-2.5 font-semibold">ลบโดย</th><th className="px-4 py-2.5 font-semibold">ลบเมื่อ</th>
                <th className="px-4 py-2.5 font-semibold">เหลือ</th><th className="px-4 py-2.5 text-right font-semibold">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border-row)]">
                  <td className="max-w-xs px-4 py-3"><div className="truncate font-medium" title={r.title}>{r.title}</div><div className="text-xs text-muted">เจ้าของ {r.ownerName}</div></td>
                  <td className="px-4 py-3"><KindChips kinds={r.kinds} /></td>
                  <td className="px-4 py-3 text-text-2">{r.deletedByName ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-2">{fmt(r.deletedAt)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 ${r.daysLeft <= 3 ? "text-red-300" : "text-text-2"}`}>เหลืออีก {r.daysLeft} วัน</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="secondary" className="mr-2 min-h-9" disabled={busy === r.id} onClick={() => restore(r)}>กู้คืน</Button>
                    <Button variant="ghost" className="min-h-9 text-red-300" disabled={busy === r.id} onClick={() => setPurge(r)}>ลบถาวร</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {purge && (
        <ConfirmDialog title="ลบถาวร" confirmLabel="ลบถาวร" danger busy={busy === purge.id} error={err} onConfirm={doPurge} onClose={() => { setPurge(null); setErr(""); }}>
          <p>“{purge.title}” จะถูกลบถาวรพร้อมประวัติเวอร์ชันและไฟล์แนบทั้งหมด <b>กู้คืนไม่ได้</b></p>
        </ConfirmDialog>
      )}
    </div>
  );
}
