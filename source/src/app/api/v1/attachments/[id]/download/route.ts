import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { userRoute } from "@/lib/api";
import { contentDisposition, isInlineMime } from "@/lib/attachment-meta";
import { getAttachmentForDownload } from "@/lib/attachments";
import { notFound } from "@/lib/errors";

/** GET /api/v1/attachments/:id/download — ตรวจสิทธิ์ทุกครั้งผ่านรายการแม่ (design §9) */
export const GET = userRoute<{ id: string }>(async ({ ctx, params }) => {
  const { row, path } = await getAttachmentForDownload(ctx, params.id);
  const stream = createReadStream(path);
  await new Promise<void>((ok, bad) => { stream.once("open", () => ok()); stream.once("error", bad); }).catch(() => { throw notFound(); });
  const inline = isInlineMime(row.mimeType); // เฉพาะรูป (ไม่รวม SVG) แสดง inline นอกนั้นบังคับดาวน์โหลด
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.sizeBytes),
      "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", row.originalName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
