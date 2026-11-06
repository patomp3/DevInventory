"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { api } from "@/components/PermissionDialog";
import { TagInput } from "@/components/TagInput";
import { Alert, Button, Dialog, Field } from "@/components/ui";
import { KIND_HINT, KIND_LABEL, KINDS, type Kind } from "@/lib/item-content";
import type { Setting } from "@/lib/permissions";
import { VIS_LABEL } from "@/lib/visibility-labels";

export type EditorInitial = {
  id?: string; version?: number; title: string; summary: string; body: string; collectionId: string; kinds: Kind[]; tags: string[];
};
type Target = { id: string; name: string; depth: number };

const BODY_PLACEHOLDER = [
  "เขียนเนื้อหาเป็น Markdown ได้ทั้งหมด เช่น",
  "",
  "## วิธีรัน",
  "```bash",
  "./deploy.sh --env staging",
  "```",
  "",
  "ลิงก์: https://example.com",
].join("\n");

/** Editor เดียวสำหรับทุกรายการ (D22): ชื่อ, คำอธิบาย, ป้าย (เลือกได้หลายป้าย), เนื้อหา Markdown, Collection/สิทธิ์/Tag */
export function ItemEditor({ initial, targets }: { initial: EditorInitial; targets: Target[] }) {
  const router = useRouter();
  const editing = !!initial.id;
  const [f, setF] = useState({ title: initial.title, summary: initial.summary, body: initial.body, collectionId: initial.collectionId });
  const [kinds, setKinds] = useState<Kind[]>(initial.kinds.length ? initial.kinds : ["note"]);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [vis, setVis] = useState<Setting>("inherit");
  const [version, setVersion] = useState(initial.version);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<{ version: number; title: string } | null>(null);
  const saving = useRef(false);

  const touch = () => setDirty(true);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); touch(); };
  const toggleKind = (k: Kind) => {
    setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : KINDS.filter((x) => x === k || cur.includes(x))));
    touch();
  };
  const canSave = !busy && !!f.title.trim() && kinds.length > 0;

  const save = useCallback(async (v = version) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setErr(""); setConflict(null);
    const payload = { title: f.title, summary: f.summary || null, body: f.body || null, kinds, tags };
    const r = editing
      ? await api(`/api/v1/items/${initial.id}`, "PUT", { ...payload, version: v })
      : await api("/api/v1/items", "POST", { ...payload, collectionId: f.collectionId || null, visibility: vis });
    saving.current = false;
    if (r.ok) {
      setDirty(false);
      router.push(`/i/${editing ? initial.id : r.data.id}`); router.refresh();
      return;
    }
    if (r.status === 409) setConflict(r.data.current);
    else setErr(r.error!);
    setBusy(false);
  }, [version, f, kinds, tags, editing, initial.id, vis, router]);

  // Ctrl+S / ⌘S บันทึก
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (canSave) save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, canSave]);

  // เตือนก่อนปิดแท็บถ้ายังไม่บันทึก
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  function cancel() {
    if (dirty && !confirm("ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) return;
    setDirty(false);
    router.back();
  }

  const select = "min-h-11 w-full rounded-[10px] border border-line bg-code px-3";
  const label = "text-[13px] font-semibold text-muted";

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      {/* แถบบน (ui-design §7.5) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={cancel} aria-label="กลับ" className="rounded-lg px-2 py-1 text-muted hover:bg-surface-hover">←</button>
        <h1 className="text-xl font-semibold">{editing ? "แก้ไขรายการ" : "สร้างรายการใหม่"}</h1>
        <span className="text-xs text-muted">
          {editing && `เวอร์ชัน ${version}`}{editing && dirty && " · "}{dirty && <span className="text-accent">ยังไม่ได้บันทึก</span>}
        </span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="secondary" onClick={cancel}>ยกเลิก</Button>
          <Button type="submit" disabled={!canSave}>บันทึก <kbd className="font-mono text-[11px] opacity-70">Ctrl S</kbd></Button>
        </div>
      </div>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Field label="ชื่อเรื่อง" required maxLength={200} value={f.title} onChange={set("title")} />
          <Field label="คำอธิบายสั้น" maxLength={500} value={f.summary} onChange={set("summary")} />
          <div className="space-y-1.5">
            <p className={label}>เนื้อหา (Markdown)</p>
            <CodeEditor label="เนื้อหา (Markdown)" language="markdown" value={f.body} onChange={(v) => { setF((x) => ({ ...x, body: v })); touch(); }}
              minHeight={360} placeholder={BODY_PLACEHOLDER} />
            <p className="text-xs text-muted">ใส่โค้ดด้วย ```ภาษา … ``` (เช่น ```bash) จะมี highlight และปุ่ม Copy ในหน้ารายละเอียด · ห้ามวางรหัสผ่าน, token หรือ credential</p>
          </div>
        </div>

        {/* คอลัมน์ขวา */}
        <aside className="space-y-5">
          <fieldset className="space-y-1.5">
            <legend className={label}>ป้าย <span className="font-normal">(เลือกได้หลายป้าย)</span></legend>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => {
                const on = kinds.includes(k);
                return (
                  <label key={k} title={KIND_HINT[k]}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${on ? "border-accent bg-accent-soft text-accent" : "border-line text-text-2 hover:bg-surface-hover"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleKind(k)} className="accent-[var(--accent)]" />
                    {KIND_LABEL[k]}
                  </label>
                );
              })}
            </div>
            {kinds.length === 0 && <p role="alert" className="text-xs text-red-300">เลือกอย่างน้อย 1 ป้าย</p>}
          </fieldset>
          {!editing && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="col" className={label}>Collection</label>
                <select id="col" value={f.collectionId} onChange={set("collectionId")} className={select}>
                  <option value="">Inbox</option>
                  {targets.map((t) => <option key={t.id} value={t.id}>{"— ".repeat(t.depth - 1)}{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="vis" className={label}>ระดับการเข้าถึง</label>
                <select id="vis" value={vis} onChange={(e) => { setVis(e.target.value as Setting); touch(); }} className={select}>
                  <option value="inherit">ตาม Collection (Inbox = ค่าเริ่มต้นของทีม)</option>
                  {(["private", "workspace_view", "workspace_edit"] as const).map((o) => <option key={o} value={o}>{VIS_LABEL[o]}</option>)}
                </select>
              </div>
            </>
          )}
          <TagInput value={tags} onChange={(v) => { setTags(v); touch(); }} />
          {editing && <p className="text-xs text-muted">ย้าย Collection และเปลี่ยนสิทธิ์ได้จากหน้ารายละเอียด</p>}
          <p className="text-xs text-muted">ไฟล์แนบจะเพิ่มในขั้นถัดไป (อยู่ใต้รายการนี้)</p>
        </aside>
      </div>

      {conflict && (
        <Dialog title="มีคนแก้ไขรายการนี้ไปก่อนแล้ว" onClose={() => setConflict(null)} width={480}>
          <div className="space-y-4">
            <p className="text-sm text-text-2">รายการนี้ถูกบันทึกเป็นเวอร์ชัน {conflict.version} ระหว่างที่คุณแก้ไข</p>
            <p className="text-xs text-muted">เลือก “บันทึกทับ” เพื่อใช้เนื้อหาของคุณ (เวอร์ชันของอีกคนยังอยู่ในประวัติ) หรือเปิดเวอร์ชันล่าสุดในแท็บใหม่เพื่อคัดลอกส่วนที่ต้องการก่อน</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href={`/i/${initial.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-text-2 hover:bg-surface-hover">เปิดเวอร์ชันล่าสุด</Link>
              <Button type="button" variant="danger" onClick={() => { setVersion(conflict.version); save(conflict.version); }}>บันทึกทับ</Button>
            </div>
          </div>
        </Dialog>
      )}
    </form>
  );
}
