import { z } from "zod";
import { adminRoute, json, readJson } from "@/lib/api";
import { transferItem } from "@/lib/admin-items";
import { AppError } from "@/lib/errors";

const body = z.object({ newOwnerId: z.string().uuid() });

/** POST /api/v1/admin/items/:id/transfer — โอนความเป็นเจ้าของ (รายการส่วนตัวต้องเจ้าของถูกปิดบัญชี และโอนให้ตัวเองไม่ได้ — D6) */
export const POST = adminRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  await transferItem(ctx, params.id, p.data.newOwnerId, req);
  return json({ ok: true });
});
