import { json, userRoute } from "@/lib/api";
import { listVersions } from "@/lib/versions";

/** GET /api/v1/items/:id/versions — รายการเวอร์ชัน (ใหม่ → เก่า) ต้องมีสิทธิ์ดูรายการ */
export const GET = userRoute<{ id: string }>(async ({ ctx, params }) => json({ versions: await listVersions(ctx, params.id) }));
