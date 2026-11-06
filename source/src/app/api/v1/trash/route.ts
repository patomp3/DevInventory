import { json, userRoute } from "@/lib/api";
import { listTrash } from "@/lib/trash";

/** GET /api/v1/trash — เจ้าของเห็นของตัวเอง, Admin เห็นของทุกคนที่ไม่ใช่ส่วนตัว (design §10.3) */
export const GET = userRoute(async ({ ctx }) => json({ items: await listTrash(ctx) }));
