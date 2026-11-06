import { formatBytes, isInlineMime } from "@/lib/attachment-meta";

type A = { id: string; name: string; mime: string; size: number; uploadedByName: string };

/** ไฟล์แนบในหน้า Detail: รูปแสดงตัวอย่าง (inline), ไฟล์อื่นเป็นลิงก์ดาวน์โหลด — ทุกลิงก์ผ่าน API ที่ตรวจสิทธิ์ทุกครั้ง */
export function AttachmentList({ items }: { items: A[] }) {
  if (!items.length) return null;
  const url = (id: string) => `/api/v1/attachments/${id}/download`;
  const images = items.filter((a) => isInlineMime(a.mime));
  return (
    <section aria-labelledby="att-h" className="mt-6">
      <h2 id="att-h" className="mb-2 text-[13px] font-semibold text-muted">ไฟล์แนบ <span className="font-mono font-normal">({items.length})</span></h2>
      {images.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {images.map((a) => (
            <li key={a.id}>
              <a href={url(a.id)} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-line bg-code">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url(a.id)} alt={a.name} loading="lazy" className="h-28 w-auto max-w-[220px] object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <ul className="divide-y divide-[var(--border-row)] rounded-xl border border-line">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <a href={url(a.id)} {...(isInlineMime(a.mime) ? { target: "_blank", rel: "noopener" } : {})} className="min-w-0 flex-1 truncate text-accent underline" title={a.name}>{a.name}</a>
            <span className="font-mono text-xs text-muted">{formatBytes(a.size)}</span>
            <span className="hidden text-xs text-muted sm:inline">{a.uploadedByName}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
