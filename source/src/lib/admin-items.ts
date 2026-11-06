// หน้า Admin › รายการส่วนตัว + โอนความเป็นเจ้าของ (design.md §4.3, D6)
// Admin เห็นรายการส่วนตัวของคนอื่นได้ "เฉพาะ metadata": query นี้เลือกเฉพาะคอลัมน์ที่ระบุ ห้ามเพิ่ม body / summary / search_text / ชื่อไฟล์แนบ
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { attachments, items, users } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { isUuid } from "@/lib/uuid";
import type { Kind } from "@/lib/item-content";
import { canTransfer, type Ctx } from "@/lib/permissions";

export type PrivateItemMeta = {
  id: string; title: string; kinds: Kind[]; createdAt: Date; sizeBytes: number;
  owner: { id: string; name: string; email: string; status: string };
};

/** ต้องเรียกหลัง requireAdmin เท่านั้น (route ตรวจให้แล้ว) — คืนเฉพาะ metadata ของรายการส่วนตัวใน workspace ตัวเอง */
export async function listPrivateItems(ctx: Ctx, limit = 500): Promise<PrivateItemMeta[]> {
  if (ctx.role !== "admin") throw notFound();
  const rows = await db().select({
    id: items.id, title: items.title, kinds: items.kinds, createdAt: items.createdAt,
    sizeBytes: sql<number>`(coalesce(octet_length(${items.body}), 0) + coalesce((SELECT sum(${attachments.sizeBytes}) FROM ${attachments}
      WHERE ${attachments.itemId} = ${items.id} AND ${attachments.deletedAt} IS NULL), 0))::float8`,
    ownerId: users.id, ownerName: users.displayName, ownerEmail: users.email, ownerStatus: users.status,
  }).from(items).innerJoin(users, eq(users.id, items.ownerId))
    .where(and(eq(items.workspaceId, ctx.workspaceId), isNull(items.deletedAt), eq(items.effectiveVisibility, "private")))
    .orderBy(desc(items.createdAt)).limit(limit);
  return rows.map((r) => ({
    id: r.id, title: r.title, kinds: r.kinds as Kind[], createdAt: r.createdAt, sizeBytes: Number(r.sizeBytes),
    owner: { id: r.ownerId, name: r.ownerName, email: r.ownerEmail, status: r.ownerStatus },
  }));
}

/** ผู้รับโอนที่เลือกได้: ผู้ใช้ที่ active ใน workspace ไม่รวม Admin ที่กำลังโอน (กันเปิดอ่านรายการส่วนตัวของผู้อื่น — D6) */
export async function listTransferCandidates(ctx: Ctx) {
  return db().select({ id: users.id, name: users.displayName, email: users.email })
    .from(users).where(and(eq(users.workspaceId, ctx.workspaceId), eq(users.status, "active"), sql`${users.id} <> ${ctx.userId}`))
    .orderBy(asc(users.displayName));
}

/**
 * โอนความเป็นเจ้าของ (Admin เท่านั้น): กฎอยู่ที่ canTransfer — รายการส่วนตัวโอนได้เฉพาะเมื่อเจ้าของถูกปิดบัญชี
 * และผู้รับต้องเป็นคนอื่นที่ active ไม่ใช่ Admin เอง · ระดับการเข้าถึงคงเดิม (ส่วนตัวยังส่วนตัว) · บันทึก audit เสมอ
 */
export async function transferItem(ctx: Ctx, itemId: string, newOwnerId: string, req: Request | null) {
  if (ctx.role !== "admin" || !isUuid(itemId)) throw notFound();
  await db().transaction(async (tx) => {
    const [it] = await tx.select().from(items).where(and(eq(items.id, itemId), eq(items.workspaceId, ctx.workspaceId))).for("update");
    if (!it || it.deletedAt) throw notFound();
    const [owner] = await tx.select().from(users).where(eq(users.id, it.ownerId));
    const [next] = await tx.select().from(users).where(and(eq(users.id, newOwnerId), eq(users.workspaceId, ctx.workspaceId)));
    if (!next || next.status !== "active") throw new AppError(422, "invalid_new_owner");
    if (next.id === it.ownerId) throw new AppError(422, "same_owner");
    const ownerDisabled = !owner || owner.status !== "active";
    if (!canTransfer(ctx, it, { ownerDisabled, newOwnerId, newOwnerActive: true })) {
      // รายการส่วนตัว: เหตุผลที่โอนไม่ได้ (เจ้าของยัง active หรือจะโอนให้ตัวเอง)
      throw new AppError(403, next.id === ctx.userId && ownerDisabled ? "cannot_transfer_to_self" : "owner_active");
    }
    await tx.update(items).set({ ownerId: newOwnerId, updatedAt: new Date() }).where(eq(items.id, itemId));
    await audit(tx, req, {
      workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.owner_transferred", targetType: "item", targetId: itemId,
      before: { ownerId: it.ownerId, ownerEmail: owner?.email ?? null, title: it.title },
      after: { ownerId: newOwnerId, ownerEmail: next.email, effective: it.effectiveVisibility },
    });
  });
}
