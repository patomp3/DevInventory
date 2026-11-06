import { json, userRoute } from "@/lib/api";
import { purgeItem } from "@/lib/trash";

/** DELETE /api/v1/trash/:id — ลบถาวร (รวมไฟล์แนบจริง) ถาวร กู้คืนไม่ได้ */
export const DELETE = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  await purgeItem(ctx, params.id, req);
  return json({ ok: true });
});
