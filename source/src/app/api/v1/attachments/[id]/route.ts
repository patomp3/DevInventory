import { json, userRoute } from "@/lib/api";
import { deleteAttachment } from "@/lib/attachments";

/** DELETE /api/v1/attachments/:id — soft delete (ต้อง canEdit รายการแม่) */
export const DELETE = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  await deleteAttachment(ctx, params.id, req);
  return json({ ok: true });
});
