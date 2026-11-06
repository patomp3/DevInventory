import { adminRoute, json } from "@/lib/api";
import { listPrivateItems } from "@/lib/admin-items";

/** GET /api/v1/admin/private-items — เฉพาะ metadata ของรายการส่วนตัว (ชื่อ เจ้าของ วันที่ ขนาด) ไม่มีเนื้อหา (D6) */
export const GET = adminRoute(async ({ ctx }) => json({ items: await listPrivateItems(ctx) }));
