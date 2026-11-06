// ประวัติเวอร์ชันของรายการ (design.md §10.1) — สิทธิ์ตามรายการแม่: ดูได้เมื่อ canView, กู้ได้เมื่อ canEdit
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemVersions, items, users } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { snapshotToView, type SnapshotView } from "@/lib/item-history";
import { loadItem, updateItem } from "@/lib/items";
import { canEdit, type Ctx } from "@/lib/permissions";

export type VersionRow = { version: number; editedByName: string; createdAt: Date };

/** รายการเวอร์ชัน (ใหม่ → เก่า) ของรายการที่มองเห็น; ไม่มีสิทธิ์ดู = 404 */
export async function listVersions(ctx: Ctx, itemId: string): Promise<VersionRow[]> {
  await loadItem(db(), ctx, itemId);
  return db().select({ version: itemVersions.version, editedByName: users.displayName, createdAt: itemVersions.createdAt })
    .from(itemVersions).innerJoin(users, eq(users.id, itemVersions.editedBy))
    .innerJoin(items, eq(items.id, itemVersions.itemId))
    .where(and(eq(itemVersions.itemId, itemId), eq(items.workspaceId, ctx.workspaceId)))
    .orderBy(desc(itemVersions.version));
}

/** snapshot ของเวอร์ชันหนึ่ง (แปลงเป็นรูปแบบปัจจุบันเสมอ) พร้อมเวอร์ชันก่อนหน้าสำหรับ diff */
export async function getVersionWithPrev(ctx: Ctx, itemId: string, version: number): Promise<{
  version: number; editedByName: string; createdAt: Date; view: SnapshotView; prev: { version: number; view: SnapshotView } | null;
}> {
  await loadItem(db(), ctx, itemId);
  const rows = await db().select({ version: itemVersions.version, snapshot: itemVersions.snapshot, createdAt: itemVersions.createdAt, by: users.displayName })
    .from(itemVersions).innerJoin(users, eq(users.id, itemVersions.editedBy))
    .where(eq(itemVersions.itemId, itemId)).orderBy(asc(itemVersions.version));
  const i = rows.findIndex((r) => r.version === version);
  if (i < 0) throw notFound();
  const cur = rows[i]!, prev = rows[i - 1];
  return {
    version: cur.version, editedByName: cur.by, createdAt: cur.createdAt, view: snapshotToView(cur.snapshot),
    prev: prev ? { version: prev.version, view: snapshotToView(prev.snapshot) } : null,
  };
}

/**
 * กู้เวอร์ชัน: เขียนเนื้อหาของเวอร์ชันเก่ากลับเป็น "เวอร์ชันใหม่" (ไม่ลบประวัติ, ไม่รวมกับเวอร์ชันล่าสุด)
 * ใช้ optimistic locking ตาม `expectedVersion` (เวอร์ชันที่ผู้ใช้เห็นอยู่) — ถ้ามีคนแก้ไปก่อน = 409
 */
export async function restoreVersion(ctx: Ctx, itemId: string, version: number, expectedVersion: number, req: Request | null): Promise<number> {
  const old = await getVersionWithPrev(ctx, itemId, version); // ตรวจ canView + มีเวอร์ชันนี้จริง
  const cur = await loadItem(db(), ctx, itemId);
  if (!canEdit(ctx, cur)) throw new AppError(403, "forbidden"); // สิทธิ์ก่อนเงื่อนไขอื่นเสมอ
  if (cur.version === version) throw new AppError(422, "already_current");
  return updateItem(ctx, itemId, { ...old.view, version: expectedVersion }, req, {
    noMerge: true, action: "item.version_restored", auditExtra: { restoredFrom: version },
  });
}
