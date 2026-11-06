import { json, userRoute } from "@/lib/api";
import { searchItems } from "@/lib/search/query";

/** GET /api/v1/search?q=&kind=&tag=&lang=&page= — ผล + total + facet (กรองสิทธิ์ใน SQL ทุกส่วน) */
export const GET = userRoute(async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams;
  const page = Math.min(500, Math.max(0, Number(sp.get("page") ?? 0) | 0));
  const r = await searchItems(ctx, { q: sp.get("q") ?? "", kind: sp.get("kind") ?? "", tag: sp.get("tag") ?? "", lang: sp.get("lang") ?? "", page });
  const { parsed: _parsed, ...rest } = r;
  void _parsed;
  return json(rest);
});
