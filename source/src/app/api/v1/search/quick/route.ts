import { json, userRoute } from "@/lib/api";
import { quickSearch } from "@/lib/search/query";

/** GET /api/v1/search/quick?q= — Ctrl+K: ชื่อเรื่อง/tag สูงสุด 8 รายการ */
export const GET = userRoute(async ({ req, ctx }) => json({ items: await quickSearch(ctx, new URL(req.url).searchParams.get("q") ?? "") }));
