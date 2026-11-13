"use client";
import { useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { apiError } from "@/components/PermissionDialog";
import { tNow } from "@/lib/i18n/client";
import { formatBytes, isInlineMime, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_ITEM } from "@/lib/attachment-meta";

export type AttachmentView = { id: string; name: string; mime: string; size: number };

const url = (id: string) => `/api/v1/attachments/${id}/download`;

/** อัปโหลดไฟล์เดียว (multipart) — คืน attachment หรือข้อความ error ตามภาษาของผู้ใช้ */
export async function uploadFile(itemId: string, file: File): Promise<{ ok: true; attachment: AttachmentView } | { ok: false; error: string }> {
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: tNow("att.tooLarge", { name: file.name }) };
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await fetch(`/api/v1/items/${itemId}/attachments`, { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `${file.name}: ${apiError(data.error, "att.uploadFailed")}` };
    return { ok: true, attachment: data.attachment };
  } catch {
    return { ok: false, error: tNow("att.netError", { name: file.name }) };
  }
}

/**
 * ไฟล์แนบใน Editor (ui-design `Dropzone`)
 * - itemId มี (หน้าแก้ไข): อัปโหลดทันที และลบได้ทันที
 * - itemId ไม่มี (หน้าสร้างใหม่): เก็บไฟล์ไว้ใน pending แล้วอัปโหลดหลังบันทึกรายการ
 */
export function AttachmentPanel({ itemId, files, onFiles, pending, onPending }: {
  itemId: string | null; files: AttachmentView[]; onFiles: (f: AttachmentView[]) => void;
  pending: File[]; onPending: (f: File[]) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [errs, setErrs] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const total = files.length + pending.length;

  async function add(list: FileList | File[]) {
    const picked = [...list];
    const room = MAX_ATTACHMENTS_PER_ITEM - total;
    const msgs: string[] = [];
    if (picked.length > room) msgs.push(t("att.max", { n: MAX_ATTACHMENTS_PER_ITEM }));
    const take = picked.slice(0, Math.max(0, room));
    if (!itemId) {
      const ok = take.filter((f) => (f.size > MAX_ATTACHMENT_BYTES ? (msgs.push(t("att.tooLarge", { name: f.name })), false) : true));
      onPending([...pending, ...ok]);
      setErrs(msgs);
      return;
    }
    setBusy((n) => n + take.length);
    let cur = files;
    for (const f of take) {
      const r = await uploadFile(itemId, f);
      if (r.ok) { cur = [...cur, r.attachment]; onFiles(cur); } else msgs.push(r.error);
      setBusy((n) => n - 1);
    }
    setErrs(msgs);
  }

  async function remove(a: AttachmentView) {
    if (!confirm(t("att.confirmDelete", { name: a.name }))) return;
    const r = await fetch(`/api/v1/attachments/${a.id}`, { method: "DELETE" });
    if (r.ok) onFiles(files.filter((x) => x.id !== a.id));
    else setErrs([t("att.deleteFailed", { name: a.name })]);
  }

  async function copyLink(a: AttachmentView) {
    const md = `${isInlineMime(a.mime) ? "!" : ""}[${a.name}](${url(a.id)})`;
    await navigator.clipboard.writeText(md);
    setCopied(a.id);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <section aria-labelledby="att-h" className="space-y-2">
      <h2 id="att-h" className="text-[13px] font-semibold text-muted">{t("att.title")} {total > 0 && <span className="font-mono font-normal">({total})</span>}</h2>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); }}
        className={`rounded-[10px] border border-dashed p-4 text-center text-sm ${over ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
        <p>{t("att.drop")}{" "}
          <button type="button" onClick={() => input.current?.click()} className="text-accent underline">{t("att.choose")}</button>
        </p>
        <p className="mt-1 text-xs">{t("att.limit")}{!itemId && ` · ${t("att.afterSave")}`}</p>
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>
      {busy > 0 && <p role="status" className="text-xs text-muted">{t("att.uploading", { n: busy })}</p>}
      {errs.length > 0 && <ul role="alert" className="space-y-0.5 text-xs text-red-300">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {total > 0 && (
        <ul className="divide-y divide-[var(--border-row)] rounded-[10px] border border-line">
          {files.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <a href={url(a.id)} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-text-2 hover:text-text" title={a.name}>{a.name}</a>
              <span className="font-mono text-xs text-muted">{formatBytes(a.size)}</span>
              <button type="button" onClick={() => copyLink(a)} className="rounded px-1.5 py-1 text-xs text-muted hover:bg-surface-hover hover:text-text" title={t("att.copyLinkTitle")}>
                {copied === a.id ? t("common.copied") : t("att.link")}
              </button>
              <button type="button" aria-label={t("att.delete", { name: a.name })} onClick={() => remove(a)} className="rounded px-1.5 py-1 text-muted hover:bg-surface-hover hover:text-red-300">✕</button>
            </li>
          ))}
          {pending.map((f, i) => (
            <li key={`p${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-text-2" title={f.name}>{f.name}</span>
              <span className="font-mono text-xs text-muted">{formatBytes(f.size)}</span>
              <span className="text-xs text-faint">{t("att.pending")}</span>
              <button type="button" aria-label={t("common.removeFile", { name: f.name })} onClick={() => onPending(pending.filter((_, j) => j !== i))} className="rounded px-1.5 py-1 text-muted hover:bg-surface-hover hover:text-red-300">✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
