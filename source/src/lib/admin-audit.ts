// หน้า Admin › Audit log (design.md §11): กรองตาม action / ผู้ใช้ / ช่วงวันที่ + Export CSV — เฉพาะ workspace ของ Admin
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { auditLogs, users } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { isIsoDay, type AuditRow } from "@/lib/audit-format";
import type { Ctx } from "@/lib/permissions";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX = 50_000;
export type AuditFilter = { action?: string; userId?: string; from?: string; to?: string };

const TZ = "Asia/Bangkok";

function where(ctx: Ctx, f: AuditFilter): SQL {
  const c: SQL[] = [eq(auditLogs.workspaceId, ctx.workspaceId)];
  if (f.action) c.push(eq(auditLogs.action, f.action));
  if (f.userId) c.push(eq(auditLogs.actorId, f.userId));
  // ช่วงวันที่ตามเวลาไทย: จากต้นวัน "from" ถึงสิ้นวัน "to"
  if (isIsoDay(f.from)) c.push(gte(auditLogs.createdAt, sql`(${f.from}::date::timestamp AT TIME ZONE ${TZ})`));
  if (isIsoDay(f.to)) c.push(lt(auditLogs.createdAt, sql`((${f.to}::date + 1)::timestamp AT TIME ZONE ${TZ})`));
  return and(...c)!;
}

const cols = {
  id: auditLogs.id, createdAt: auditLogs.createdAt, actorName: users.displayName, actorEmail: users.email, action: auditLogs.action,
  targetType: auditLogs.targetType, targetId: auditLogs.targetId, before: auditLogs.before, after: auditLogs.after, ip: auditLogs.ip,
};

export async function queryAudit(ctx: Ctx, f: AuditFilter, page: number): Promise<{ rows: AuditRow[]; total: number }> {
  if (ctx.role !== "admin") throw notFound();
  const w = where(ctx, f);
  const [rows, [t]] = await Promise.all([
    db().select(cols).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(w)
      .orderBy(desc(auditLogs.id)).limit(AUDIT_PAGE_SIZE).offset(Math.max(0, page) * AUDIT_PAGE_SIZE),
    db().select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(w),
  ]);
  return { rows, total: t?.n ?? 0 };
}

/** แถวสำหรับ export CSV (ไม่แบ่งหน้า สูงสุด AUDIT_EXPORT_MAX) */
export async function exportAudit(ctx: Ctx, f: AuditFilter): Promise<AuditRow[]> {
  if (ctx.role !== "admin") throw notFound();
  return db().select(cols).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(where(ctx, f))
    .orderBy(desc(auditLogs.id)).limit(AUDIT_EXPORT_MAX);
}

/** ตัวเลือกของตัวกรอง: action ที่เคยเกิดใน workspace นี้ และผู้ใช้ที่เคยกระทำ */
export async function auditFilterOptions(ctx: Ctx) {
  if (ctx.role !== "admin") throw notFound();
  const [actions, actors] = await Promise.all([
    db().selectDistinct({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.workspaceId, ctx.workspaceId)).orderBy(auditLogs.action),
    db().selectDistinct({ id: users.id, name: users.displayName, email: users.email }).from(auditLogs).innerJoin(users, eq(users.id, auditLogs.actorId))
      .where(eq(auditLogs.workspaceId, ctx.workspaceId)).orderBy(users.displayName),
  ]);
  return { actions: actions.map((a) => a.action), actors };
}
