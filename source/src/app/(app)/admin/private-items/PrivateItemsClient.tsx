"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KindChips } from "@/components/KindChips";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Dialog } from "@/components/ui";
import { formatBytes } from "@/lib/attachment-meta";
import type { Kind } from "@/lib/item-content";

type Owner = { id: string; name: string; email: string; status: string };
type Row = { id: string; title: string; kinds: Kind[]; createdAt: string; sizeBytes: number; owner: Owner };
type Candidate = { id: string; name: string; email: string };

/** Admin › รายการส่วนตัว (ui-design §7.10): metadata เท่านั้น ไม่มีปุ่มเปิดดู · ปุ่ม "โอน" เฉพาะแถวที่เจ้าของถูกปิดบัญชี (D6) */
export function PrivateItemsClient({ rows, candidates }: { rows: Row[]; candidates: Candidate[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Row | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function transfer() {
    if (!target || !pick) return;
    setBusy(true); setErr("");
    const r = await api(`/api/v1/admin/items/${target.id}/transfer`, "POST", { newOwnerId: pick });
    setBusy(false);
    if (!r.ok) return setErr(r.error!);
    const to = candidates.find((c) => c.id === pick);
    setNotice(`โอน “${target.title}” ให้ ${to?.name ?? "ผู้ใช้ใหม่"} แล้ว (ระดับการเข้าถึงยังเป็นส่วนตัว)`);
    setTarget(null); setPick("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">รายการส่วนตัว</h1>
        <p className="mt-1 text-sm text-muted">เห็นเฉพาะ metadata (ชื่อ เจ้าของ วันที่ ขนาด) — <b className="text-text-2">เปิดเนื้อหาไม่ได้</b> แม้เป็น Admin (D6) · โอนได้เฉพาะรายการที่เจ้าของถูกปิดบัญชี</p>
      </div>
      {notice && <Alert tone="info">{notice}</Alert>}

      {rows.length === 0 ? <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">ยังไม่มีรายการส่วนตัวใน Workspace นี้</p> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">รายการส่วนตัว (metadata)</caption>
            <thead className="bg-sidebar text-left text-xs text-muted">
              <tr><th className="px-4 py-2.5 font-semibold">ชื่อเรื่อง</th><th className="px-4 py-2.5 font-semibold">เจ้าของ</th><th className="px-4 py-2.5 font-semibold">สร้างเมื่อ</th><th className="px-4 py-2.5 font-semibold">ขนาด</th><th className="px-4 py-2.5 text-right font-semibold">การกระทำ</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const disabled = r.owner.status !== "active";
                return (
                  <tr key={r.id} className="border-t border-[var(--border-row)]">
                    <td className="max-w-xs px-4 py-3"><div className="truncate font-medium" title={r.title}>{r.title}</div><KindChips kinds={r.kinds} /></td>
                    <td className="px-4 py-3"><div>{r.owner.name}</div><div className="text-xs text-muted">{r.owner.email}{disabled && <span className="ml-2 rounded bg-red-500/10 px-1.5 text-red-200">ปิดบัญชี</span>}</div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-2">{new Date(r.createdAt).toLocaleDateString("th-TH")}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-2">{formatBytes(r.sizeBytes)}</td>
                    <td className="px-4 py-3 text-right">
                      {disabled ? <Button variant="secondary" className="min-h-9" onClick={() => { setTarget(r); setPick(""); setErr(""); }}>โอน</Button> : <span className="text-xs text-faint">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <Dialog title="โอนความเป็นเจ้าของ" onClose={() => !busy && setTarget(null)} width={520}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <p className="text-sm text-text-2">รายการ: <b>{target.title}</b></p>
            <div className="rounded-[10px] border border-line bg-code p-3 text-sm">
              <div className="text-xs text-muted">เจ้าของเดิม</div>
              <div>{target.owner.name} <span className="text-muted">({target.owner.email})</span> <span className="rounded bg-red-500/10 px-1.5 text-xs text-red-200">ปิดบัญชี</span></div>
              <div className="mt-1 text-xs text-muted">ระดับการเข้าถึงคงเป็น “ส่วนตัว” หลังโอน</div>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] font-semibold text-muted">ผู้รับโอน (ผู้ใช้ที่ใช้งานอยู่ ไม่รวมตัวคุณเอง)</legend>
              {candidates.length === 0 ? <p className="text-sm text-muted">ไม่มีผู้ใช้อื่นที่ใช้งานอยู่</p> : (
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {candidates.map((c) => (
                    <label key={c.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm ${pick === c.id ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover"}`}>
                      <input type="radio" name="owner" checked={pick === c.id} onChange={() => setPick(c.id)} className="accent-[var(--accent)]" />
                      <span>{c.name} <span className="text-xs text-muted">{c.email}</span></span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <p className="text-xs text-muted">เจ้าของใหม่เท่านั้นที่เห็นเนื้อหา · การโอนบันทึกใน Audit log (<code className="font-mono">item.owner_transferred</code>)</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>ยกเลิก</Button>
              <Button onClick={transfer} disabled={busy || !pick}>โอนความเป็นเจ้าของ</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
