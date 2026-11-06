// ถังขยะ (design.md §10.3): รายการ / กู้คืน / ลบถาวร (รวมไฟล์แนบจริงบนดิสก์) / ลบอัตโนมัติเมื่อเกิน 30 วัน
import { rm } from "node:fs/promises";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { storagePath } from "@/lib/attachments";
import { audit } from "@/lib/audit";
import { workspaceDefault, type Tx } from "@/lib/collections";
import { db } from "@/lib/db";
import { attachments, collections, items, users } from "@/lib/db/schema";
import { notFound } from "@/lib/errors";
import { isUuid } from "@/lib/uuid";
import type { Kind } from "@/lib/item-content";
import { canManageTrashed, resolveEffective, trashedItemsWhere, type Ctx, type Effective, type Setting } from "@/lib/permissions";

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrashRow = {
  id: string; title: string; kinds: Kind[]; ownerName: string; deletedByName: string | null; deletedAt: Date; daysLeft: number;
};

/** หน้าถังขยะ: เจ้าของเห็นของตัวเอง, Admin เห็นของทุกคนเฉพาะที่ไม่ใช่ส่วนตัว (trashedItemsWhere) */
export async function listTrash(ctx: Ctx, now = new Date()): Promise<TrashRow[]> {
  const del = alias(users, "deleter");
  const rows = await db().select({
    id: items.id, title: items.title, kinds: items.kinds, ownerName: users.displayName, deletedByName: del.displayName, deletedAt: items.deletedAt,
  }).from(items).innerJoin(users, eq(users.id, items.ownerId)).leftJoin(del, eq(del.id, items.deletedBy))
    .where(trashedItemsWhere(ctx)).orderBy(items.deletedAt);
  return rows.map((r) => ({
    ...r, kinds: r.kinds as Kind[], deletedAt: r.deletedAt!,
    daysLeft: Math.max(0, Math.ceil((r.deletedAt!.getTime() + TRASH_DAYS * DAY_MS - now.getTime()) / DAY_MS)),
  })).reverse();
}

async function loadTrashed(tx: Tx, ctx: Ctx, id: string) {
  if (!isUuid(id)) throw notFound();
  const [r] = await tx.select().from(items).where(and(eq(items.id, id), eq(items.workspaceId, ctx.workspaceId))).for("update");
  if (!r || !canManageTrashed(ctx, r)) throw notFound(); // ไม่มี/ไม่ใช่ของถังขยะ/ไม่มีสิทธิ์ = 404 เหมือนกันหมด
  return r;
}

/** กู้คืน: กลับไปอยู่ Collection เดิม (ถ้า Collection ถูกลบไปแล้วจะกลับไป Inbox) และคำนวณ effective_visibility ใหม่ */
export async function restoreItem(ctx: Ctx, id: string, req: Request | null): Promise<{ movedToInbox: boolean }> {
  return db().transaction(async (tx) => {
    const r = await loadTrashed(tx, ctx, id);
    const wsDefault = await workspaceDefault(tx, ctx.workspaceId);
    let collectionId = r.collectionId;
    let parentEff: Effective | null = null;
    if (collectionId) {
      const [c] = await tx.select().from(collections).where(and(eq(collections.id, collectionId), eq(collections.workspaceId, ctx.workspaceId)));
      if (!c || c.deletedAt) collectionId = null; else parentEff = c.effectiveVisibility;
    }
    // Inbox ห้าม inherit (กฎข้อ 4): แปลงเป็นค่า default ของ workspace
    const visibility: Setting = !collectionId && r.visibility === "inherit" ? wsDefault : r.visibility;
    const effective = resolveEffective(visibility, parentEff, wsDefault);
    await tx.update(items).set({ deletedAt: null, deletedBy: null, collectionId, visibility, effectiveVisibility: effective, updatedAt: new Date() }).where(eq(items.id, id));
    await audit(tx, req, {
      workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.restored", targetType: "item", targetId: id,
      after: { title: r.title, collectionId, effective, movedToInbox: r.collectionId !== null && collectionId === null },
    });
    return { movedToInbox: r.collectionId !== null && collectionId === null };
  });
}

/** ลบแถวไฟล์แนบ + รายการ (versions/tags ลบตาม cascade) ใน transaction คืน path ไฟล์จริงที่ต้องลบหลัง commit */
async function purgeRows(tx: Tx, rows: { id: string; workspaceId: string; title: string }[], actorId: string | null, req: Request | null, reason: string) {
  const files: string[] = [];
  for (const r of rows) {
    const atts = await tx.select({ id: attachments.id, key: attachments.storageKey, ws: attachments.workspaceId }).from(attachments).where(eq(attachments.itemId, r.id));
    for (const a of atts) files.push(storagePath(a.ws, a.key));
    if (atts.length) await tx.delete(attachments).where(eq(attachments.itemId, r.id));
    await tx.delete(items).where(eq(items.id, r.id));
    await audit(tx, req, {
      workspaceId: r.workspaceId, actorId, action: "item.purged", targetType: "item", targetId: r.id,
      before: { title: r.title }, after: { reason, attachments: atts.length },
    });
  }
  return files;
}
const removeFiles = (paths: string[]) => Promise.all(paths.map((p) => rm(p, { force: true }).catch(() => {}))); // ลบไฟล์หลัง commit: พังกลางทางได้ไฟล์กำพร้า ไม่ใช่ข้อมูลหาย

/** ลบถาวรด้วยมือ (ผู้ใช้กดยืนยันในหน้าถังขยะ) */
export async function purgeItem(ctx: Ctx, id: string, req: Request | null) {
  const files = await db().transaction(async (tx) => {
    const r = await loadTrashed(tx, ctx, id);
    return purgeRows(tx, [{ id: r.id, workspaceId: r.workspaceId, title: r.title }], ctx.userId, req, "manual");
  });
  await removeFiles(files);
}

/**
 * งานรายคืน (§10.3): ลบถาวรรายการที่ deleted_at เกิน 30 วัน รวมไฟล์จริง + ไฟล์แนบที่ถูกลบมาเกิน 30 วัน
 * ไม่มีผู้ใช้ (actor = null) บันทึก audit เหตุผล "retention"
 */
export async function purgeExpired(now = new Date(), days = TRASH_DAYS): Promise<{ items: number; attachments: number }> {
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  let nItems = 0, nAtt = 0;
  for (;;) {
    const batch = await db().select({ id: items.id, workspaceId: items.workspaceId, title: items.title }).from(items)
      .where(and(isNotNull(items.deletedAt), lt(items.deletedAt, cutoff))).limit(50);
    if (!batch.length) break;
    const files = await db().transaction((tx) => purgeRows(tx, batch, null, null, "retention"));
    await removeFiles(files);
    nItems += batch.length;
  }
  for (;;) {
    const old = await db().select().from(attachments).where(and(isNotNull(attachments.deletedAt), lt(attachments.deletedAt, cutoff))).limit(100);
    if (!old.length) break;
    await db().transaction(async (tx) => {
      await tx.delete(attachments).where(inArray(attachments.id, old.map((a) => a.id)));
      for (const a of old) {
        await audit(tx, null, { workspaceId: a.workspaceId, actorId: null, action: "attachment.purged", targetType: "item", targetId: a.itemId, before: { attachmentId: a.id, name: a.originalName }, after: { reason: "retention" } });
      }
    });
    await removeFiles(old.map((a) => storagePath(a.workspaceId, a.storageKey)));
    nAtt += old.length;
  }
  return { items: nItems, attachments: nAtt };
}
