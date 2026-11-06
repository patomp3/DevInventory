import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { restoreVersion } from "@/lib/versions";

const body = z.object({ version: z.number().int().positive() }); // เวอร์ชันปัจจุบันที่ผู้ใช้เห็น (optimistic locking)

/** POST /api/v1/items/:id/versions/:v/restore — กู้เป็นเวอร์ชันใหม่ (ต้อง canEdit; มีคนแก้ไปก่อน = 409) */
export const POST = userRoute<{ id: string; v: string }>(async ({ req, ctx, params }) => {
  const v = Number(params.v);
  const p = body.safeParse(await readJson(req));
  if (!Number.isInteger(v) || v < 1 || !p.success) throw new AppError(422, "validation");
  return json({ version: await restoreVersion(ctx, params.id, v, p.data.version, req) });
});
