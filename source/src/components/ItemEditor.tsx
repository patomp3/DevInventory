"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Dialog, Field } from "@/components/ui";
import type { Setting } from "@/lib/permissions";
import { VIS_LABEL } from "@/lib/visibility-labels";

type Initial = { id?: string; version?: number; type: "note" | "link"; title: string; summary: string; body: string; url: string; collectionId: string };
type Target = { id: string; name: string; depth: number };

export function ItemEditor({ initial, targets }: { initial: Initial; targets: Target[] }) {
  const router = useRouter();
  const editing = !!initial.id;
  const [type, setType] = useState(initial.type);
  const [f, setF] = useState(initial);
  const [vis, setVis] = useState<Setting>("inherit");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ version: number; title: string } | null>(null);
  const set = (k: keyof Initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(version = f.version) {
    setBusy(true); setErr(""); setConflict(null);
    const payload = { title: f.title, summary: f.summary || null, body: f.body || null, url: type === "link" ? f.url : null };
    const r = editing
      ? await api(`/api/v1/items/${f.id}`, "PUT", { ...payload, version })
      : await api("/api/v1/items", "POST", { ...payload, type, collectionId: f.collectionId || null, visibility: vis });
    if (r.ok) { router.push(`/i/${editing ? f.id : r.data.id}`); router.refresh(); return; }
    if (r.status === 409) setConflict(r.data.current);
    else setErr(r.error!);
    setBusy(false);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">{editing ? "แก้ไขรายการ" : "สร้างรายการใหม่"}</h1>
      {err && <Alert>{err}</Alert>}
      {!editing && (
        <fieldset className="flex gap-2">
          <legend className="sr-only">ประเภท</legend>
          {(["note", "link"] as const).map((t) => (
            <label key={t} className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm ${type === t ? "border-accent bg-accent-soft text-accent" : "border-line text-text-2"}`}>
              <input type="radio" className="sr-only" checked={type === t} onChange={() => setType(t)} />{t === "note" ? "Note" : "Link"}
            </label>
          ))}
          <span className="self-center text-xs text-muted">Snippet / Script มาในสัปดาห์ 4 · File ในสัปดาห์ 5</span>
        </fieldset>
      )}
      <Field label="ชื่อเรื่อง" required maxLength={200} value={f.title} onChange={set("title")} />
      {type === "link" && <Field label="URL" type="url" required placeholder="https://" value={f.url} onChange={set("url")} />}
      <Field label="คำอธิบายสั้น" maxLength={500} value={f.summary} onChange={set("summary")} />
      <div className="space-y-1.5">
        <label htmlFor="body" className="text-[13px] font-semibold text-muted">เนื้อหา (Markdown)</label>
        <textarea id="body" value={f.body} onChange={set("body")} rows={14} className="w-full rounded-[10px] border border-line bg-code p-3 font-mono text-[13px] leading-7" />
        <p className="text-xs text-muted">ห้ามวางรหัสผ่านหรือ credential ในเนื้อหา</p>
      </div>
      {!editing && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="col" className="text-[13px] font-semibold text-muted">Collection</label>
            <select id="col" value={f.collectionId} onChange={(e) => setF({ ...f, collectionId: e.target.value })} className="min-h-11 w-full rounded-[10px] border border-line bg-code px-3">
              <option value="">Inbox</option>
              {targets.map((t) => <option key={t.id} value={t.id}>{"— ".repeat(t.depth - 1)}{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="vis" className="text-[13px] font-semibold text-muted">ระดับการเข้าถึง</label>
            <select id="vis" value={vis} onChange={(e) => setVis(e.target.value as Setting)} className="min-h-11 w-full rounded-[10px] border border-line bg-code px-3">
              <option value="inherit">ตาม Collection (Inbox = ค่าเริ่มต้นของทีม)</option>
              {(["private", "workspace_view", "workspace_edit"] as const).map((o) => <option key={o} value={o}>{VIS_LABEL[o]}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>ยกเลิก</Button>
        <Button type="submit" disabled={busy || !f.title.trim() || (type === "link" && !f.url.trim())}>บันทึก</Button>
      </div>
      {conflict && (
        <Dialog title="มีคนแก้ไขรายการนี้ไปก่อนแล้ว" onClose={() => setConflict(null)} width={480}>
          <div className="space-y-4">
            <p className="text-sm text-text-2">รายการนี้ถูกบันทึกเป็นเวอร์ชัน {conflict.version} ระหว่างที่คุณแก้ไข</p>
            <p className="text-xs text-muted">เลือก “บันทึกทับ” เพื่อใช้เนื้อหาของคุณ (เวอร์ชันของอีกคนยังอยู่ในประวัติ) หรือเปิดเวอร์ชันล่าสุดในแท็บใหม่เพื่อคัดลอกส่วนที่ต้องการก่อน</p>
            <div className="flex flex-wrap justify-end gap-2">
              <a href={`/i/${f.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-text-2 hover:bg-surface-hover">เปิดเวอร์ชันล่าสุด</a>
              <Button type="button" variant="danger" onClick={() => save(conflict.version)}>บันทึกทับ</Button>
            </div>
          </div>
        </Dialog>
      )}
    </form>
  );
}
