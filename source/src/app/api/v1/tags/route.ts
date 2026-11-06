import { json, userRoute } from "@/lib/api";
import { listTags } from "@/lib/tags";

/** GET /api/v1/tags?prefix= — autocomplete / tag ยอดนิยม (กรองตามสิทธิ์ design.md §8.7) */
export const GET = userRoute(async ({ req, ctx }) => {
  const q = new URL(req.url).searchParams;
  const limit = Math.max(1, Math.min(50, Number(q.get("limit") ?? 10) | 0 || 10));
  return json({ tags: await listTags(ctx, { prefix: (q.get("prefix") ?? "").slice(0, 100), limit }) });
});
