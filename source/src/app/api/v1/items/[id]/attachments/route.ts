import { json, userRoute } from "@/lib/api";
import { listAttachments, uploadAttachment } from "@/lib/attachments";
import { AppError } from "@/lib/errors";

/** GET /api/v1/items/:id/attachments — รายการไฟล์แนบ (ต้องมีสิทธิ์ดูรายการ) */
export const GET = userRoute<{ id: string }>(async ({ ctx, params }) => json({ attachments: await listAttachments(ctx, params.id) }));

/** POST /api/v1/items/:id/attachments — multipart field "file" (ต้อง canEdit, ≤ 50 MB) */
export const POST = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const form = await req.formData().catch(() => { throw new AppError(400, "invalid_form"); });
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError(422, "validation");
  return json({ attachment: await uploadAttachment(ctx, params.id, file, req) }, 201);
});
