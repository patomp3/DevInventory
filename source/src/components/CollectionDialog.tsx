"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, Dialog, Field } from "@/components/ui";
import { VIS_LABEL } from "@/lib/visibility-labels";
import type { Setting } from "@/lib/permissions";

/** สร้าง Collection ใหม่ (หรือ sub-collection ถ้ามี parentId) */
export function NewCollectionButton({ parentId, label = "+ Collection", variant = "ghost" }: { parentId?: string; label?: string; variant?: "ghost" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vis, setVis] = useState<Setting>(parentId ? "inherit" : "workspace_view");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const opts: Setting[] = [...(parentId ? (["inherit"] as const) : []), "private", "workspace_view", "workspace_edit"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await api("/api/v1/collections", "POST", { name, parentId: parentId ?? null, visibility: vis });
    if (!r.ok) { setErr(r.error!); setBusy(false); return; }
    setOpen(false); setName(""); setBusy(false);
    router.push(`/c/${r.data.id}`); router.refresh();
  }
  return (
    <>
      <Button variant={variant} className="min-h-9 px-3" onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <Dialog title={parentId ? "สร้าง Collection ย่อย" : "สร้าง Collection"} onClose={() => setOpen(false)} width={460}>
          <form onSubmit={submit} className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <Field label="ชื่อ" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="space-y-1.5">
              <label htmlFor="cvis" className="text-[13px] font-semibold text-muted">ระดับการเข้าถึง</label>
              <select id="cvis" value={vis} onChange={(e) => setVis(e.target.value as Setting)} className="min-h-11 w-full rounded-[10px] border border-line bg-code px-3">
                {opts.map((o) => <option key={o} value={o}>{VIS_LABEL[o]}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={busy || !name.trim()}>สร้าง</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
