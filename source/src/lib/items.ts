// รายการ (Note / Link ในสัปดาห์ 3) — สิทธิ์, การสืบทอด, optimistic locking, ประวัติเวอร์ชัน (design.md §6, §10)
import { and, desc, eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { audit } from "@/lib/audit";
import { loadCollection, workspaceDefault, type CollectionRow, type Tx } from "@/lib/collections";
import { db } from "@/lib/db";
import { collections, itemVersions, items, users } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { canEdit, canManage, canView, resolveEffective, visibleItemsWhere, type Ctx, type Effective, type Setting } from "@/lib/permissions";
import { buildSearchText } from "@/lib/search/normalize";

export type ItemRow = typeof items.$inferSelect;
export const AVAILABLE_TYPES = ["note", "link"] as const; // snippet/script = สัปดาห์ 4, file = สัปดาห์ 5
const MERGE_WINDOW_MS = 5 * 60 * 1000;

export type ItemContent = { title: string; summary?: string | null; body?: string | null; url?: string | null };

export function validateContent(type: string, c: ItemContent) {
  if (!(AVAILABLE_TYPES as readonly string[]).includes(type)) throw new AppError(422, "type_not_available_yet");
  if (!c.title.trim()) throw new AppError(422, "title_required");
  if (type === "link") {
    let u: URL;
    try { u = new URL(c.url ?? ""); } catch { throw new AppError(422, "invalid_url"); }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new AppError(422, "invalid_url"); // กัน javascript: ฯลฯ
  }
}

const snapshot = (r: ItemContent) => ({ title: r.title, summary: r.summary ?? null, body: r.body ?? null, url: r.url ?? null, scriptMeta: null, codeBlocks: [], tags: [] });
const searchText = (c: ItemContent) => buildSearchText({ title: c.title, summary: c.summary, body: c.body, url: c.url });

export async function loadItem(x: Pick<Tx, "select">, ctx: Ctx, id: string): Promise<ItemRow> {
  const [r] = await x.select().from(items).where(and(eq(items.id, id), eq(items.workspaceId, ctx.workspaceId)));
  if (!r || !canView(ctx, r)) throw notFound();
  return r;
}

async function effectiveFor(tx: Pick<Tx, "select">, ctx: Ctx, collectionId: string | null, visibility: Setting) {
  const wsDefault = await workspaceDefault(tx, ctx.workspaceId);
  let col: CollectionRow | null = null;
  if (collectionId) {
    col = await loadCollection(tx, ctx, collectionId);
    if (!canEdit(ctx, col)) throw new AppError(403, "forbidden");
  }
  // รายการนอก Collection (Inbox) ต้องตั้งค่าเอง: inherit → ใช้ค่า default ของ Workspace (§4.4.5)
  const vis: Setting = !col && visibility === "inherit" ? wsDefault : visibility;
  return { visibility: vis, effective: resolveEffective(vis, col?.effectiveVisibility ?? null, wsDefault) as Effective };
}

export async function createItem(
  ctx: Ctx, input: ItemContent & { type: string; collectionId?: string | null; visibility?: Setting }, req: Request | null,
) {
  validateContent(input.type, input);
  return db().transaction(async (tx) => {
    const collectionId = input.collectionId ?? null;
    const { visibility, effective } = await effectiveFor(tx, ctx, collectionId, input.visibility ?? "inherit");
    const id = uuidv7();
    await tx.insert(items).values({
      id, workspaceId: ctx.workspaceId, collectionId, type: input.type as ItemRow["type"], title: input.title.trim(),
      summary: input.summary ?? null, body: input.body ?? null, url: input.type === "link" ? input.url : null,
      ownerId: ctx.userId, visibility, effectiveVisibility: effective, searchText: searchText(input), updatedBy: ctx.userId,
    });
    await tx.insert(itemVersions).values({ itemId: id, version: 1, snapshot: snapshot(input), editedBy: ctx.userId });
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.created", targetType: "item", targetId: id, after: { type: input.type, title: input.title, visibility } });
    return id;
  });
}

export async function updateItem(ctx: Ctx, id: string, input: ItemContent & { version: number }, req: Request | null) {
  return db().transaction(async (tx) => {
    const [locked] = await tx.select().from(items).where(and(eq(items.id, id), eq(items.workspaceId, ctx.workspaceId))).for("update");
    if (!locked || !canView(ctx, locked)) throw notFound();
    if (!canEdit(ctx, locked)) throw new AppError(403, "forbidden");
    // optimistic locking: ถ้ามีคนแก้ไปก่อน ส่ง 409 พร้อมสถานะปัจจุบันให้ UI แสดง dialog (§1.1)
    if (locked.version !== input.version) throw new AppError(409, "version_conflict", { current: { version: locked.version, title: locked.title, summary: locked.summary, body: locked.body, url: locked.url } });
    validateContent(locked.type, input);

    const next = locked.version + 1;
    await tx.update(items).set({
      title: input.title.trim(), summary: input.summary ?? null, body: input.body ?? null,
      url: locked.type === "link" ? input.url : null, version: next, searchText: searchText(input),
      updatedBy: ctx.userId, updatedAt: new Date(),
    }).where(eq(items.id, id));

    // แก้ต่อเนื่องโดยคนเดิมภายใน 5 นาที รวมเป็นเวอร์ชันเดียว (§10.1)
    const [last] = await tx.select().from(itemVersions).where(eq(itemVersions.itemId, id)).orderBy(desc(itemVersions.version)).limit(1);
    if (last && last.editedBy === ctx.userId && Date.now() - last.createdAt.getTime() < MERGE_WINDOW_MS) {
      await tx.update(itemVersions).set({ version: next, snapshot: snapshot(input) }).where(eq(itemVersions.id, last.id));
    } else {
      await tx.insert(itemVersions).values({ itemId: id, version: next, snapshot: snapshot(input), editedBy: ctx.userId });
    }
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.updated", targetType: "item", targetId: id, after: { version: next } });
    return next;
  });
}

export async function setItemVisibility(ctx: Ctx, id: string, visibility: Setting, req: Request | null) {
  await db().transaction(async (tx) => {
    const r = await loadItem(tx, ctx, id);
    if (!canManage(ctx, r)) throw new AppError(403, "forbidden");
    const wsDefault = await workspaceDefault(tx, ctx.workspaceId);
    let parentEff: Effective | null = null;
    if (r.collectionId) {
      const [c] = await tx.select({ e: collections.effectiveVisibility }).from(collections).where(eq(collections.id, r.collectionId));
      parentEff = c?.e ?? null;
    } else if (visibility === "inherit") {
      throw new AppError(422, "no_parent_to_inherit"); // Inbox ต้องตั้งค่าเอง
    }
    const effective = resolveEffective(visibility, parentEff, wsDefault);
    await tx.update(items).set({ visibility, effectiveVisibility: effective, updatedAt: new Date() }).where(eq(items.id, id));
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.visibility_changed", targetType: "item", targetId: id, before: { visibility: r.visibility, effective: r.effectiveVisibility }, after: { visibility, effective } });
  });
}

export async function moveItem(ctx: Ctx, id: string, collectionId: string | null, req: Request | null) {
  await db().transaction(async (tx) => {
    const r = await loadItem(tx, ctx, id);
    if (!canManage(ctx, r)) throw new AppError(403, "forbidden");
    const { visibility, effective } = await effectiveFor(tx, ctx, collectionId, r.visibility);
    await tx.update(items).set({ collectionId, visibility, effectiveVisibility: effective, updatedAt: new Date() }).where(eq(items.id, id));
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.moved", targetType: "item", targetId: id, before: { collectionId: r.collectionId, effective: r.effectiveVisibility }, after: { collectionId, effective } });
  });
}

/** ย้ายไปถังขยะ (soft delete) — หน้าถังขยะ/กู้คืนทำในสัปดาห์ 7 */
export async function deleteItem(ctx: Ctx, id: string, req: Request | null) {
  await db().transaction(async (tx) => {
    const r = await loadItem(tx, ctx, id);
    if (!canManage(ctx, r)) throw new AppError(403, "forbidden");
    await tx.update(items).set({ deletedAt: new Date(), deletedBy: ctx.userId }).where(eq(items.id, id));
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.deleted", targetType: "item", targetId: id, before: { title: r.title } });
  });
}

export type ItemDetail = ItemRow & {
  ownerName: string;
  canEdit: boolean;
  canManage: boolean;
  breadcrumb: { id: string; name: string }[]; // เฉพาะ Collection ที่ผู้ใช้มีสิทธิ์เห็น (§4.4.6)
};

export async function getItemDetail(ctx: Ctx, id: string): Promise<ItemDetail> {
  const r = await loadItem(db(), ctx, id);
  const [o] = await db().select({ n: users.displayName }).from(users).where(eq(users.id, r.ownerId));
  const crumbs: { id: string; name: string }[] = [];
  for (let cid = r.collectionId; cid; ) {
    const [c] = await db().select().from(collections).where(eq(collections.id, cid));
    if (!c || !canView(ctx, c)) break;
    crumbs.unshift({ id: c.id, name: c.name });
    cid = c.parentId;
  }
  return { ...r, ownerName: o?.n ?? "—", canEdit: canEdit(ctx, r), canManage: canManage(ctx, r), breadcrumb: crumbs };
}

export type ListScope = { kind: "collection"; id: string } | { kind: "inbox" } | { kind: "mine" } | { kind: "recent" };
export type ItemSummary = {
  id: string; type: ItemRow["type"]; title: string; summary: string | null; updatedAt: Date;
  ownerName: string; effectiveVisibility: Effective; collectionId: string | null;
};

/** รายการตาม scope — ทุก query ผ่าน visibleItemsWhere (กรองสิทธิ์ตั้งแต่ใน SQL) */
export async function listItems(ctx: Ctx, scope: ListScope, opts: { limit?: number; offset?: number } = {}): Promise<ItemSummary[]> {
  const extra =
    scope.kind === "collection" ? eq(items.collectionId, scope.id)
    : scope.kind === "inbox" ? sql`${items.collectionId} IS NULL`
    : scope.kind === "mine" ? eq(items.ownerId, ctx.userId)
    : undefined;
  return db().select({
    id: items.id, type: items.type, title: items.title, summary: items.summary, updatedAt: items.updatedAt,
    ownerName: users.displayName, effectiveVisibility: items.effectiveVisibility, collectionId: items.collectionId,
  }).from(items).innerJoin(users, eq(users.id, items.ownerId))
    .where(and(visibleItemsWhere(ctx), extra))
    .orderBy(desc(items.updatedAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
}
