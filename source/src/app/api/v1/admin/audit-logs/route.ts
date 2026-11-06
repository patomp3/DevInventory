import { adminRoute, json } from "@/lib/api";
import { exportAudit, queryAudit } from "@/lib/admin-audit";
import { auditToCsv } from "@/lib/audit-format";

/** GET /api/v1/admin/audit-logs?action=&user=&from=&to=&page= · &format=csv = ส่งออกทั้งหมดที่ตรงตัวกรอง (สูงสุด 50,000 แถว) */
export const GET = adminRoute(async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams;
  const f = { action: sp.get("action") || undefined, userId: sp.get("user") || undefined, from: sp.get("from") || undefined, to: sp.get("to") || undefined };
  if (sp.get("format") === "csv") {
    const csv = auditToCsv(await exportAudit(ctx, f));
    return new Response(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  }
  const page = Math.min(10_000, Math.max(0, Number(sp.get("page") ?? 0) | 0));
  return json(await queryAudit(ctx, f, page));
});
