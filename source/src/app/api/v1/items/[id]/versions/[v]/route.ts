import { json, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getVersionWithPrev } from "@/lib/versions";

/** GET /api/v1/items/:id/versions/:v — เนื้อหาของเวอร์ชันนั้น (รูปแบบปัจจุบันเสมอ) + เวอร์ชันก่อนหน้า */
export const GET = userRoute<{ id: string; v: string }>(async ({ ctx, params }) => {
  const v = Number(params.v);
  if (!Number.isInteger(v) || v < 1) throw new AppError(422, "validation");
  return json(await getVersionWithPrev(ctx, params.id, v));
});
