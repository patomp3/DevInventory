// รายการ (Note ชนิดเดียว + ป้าย kinds, D22) — สิทธิ์, การสืบทอด, optimistic locking, ประวัติเวอร์ชัน (design.md §6, §10)
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { audit } from "@/lib/audit";
import { loadCollection, workspaceDefault, type CollectionRow, type Tx } from "@/lib/collections";
import { db } from "@/lib/db";
import { attachments, collections, itemTags, itemVersions, items, tags, users } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { isUuid } from "@/lib/uuid";
import { prepareContent, type ItemContent, type Kind, type PreparedContent } from "@/lib/item-content";
import { canEdit, canManage, canView, resolveEffective, visibleItemsWhere, type Ctx, type Effective, type Setting } from "@/lib/permissions";
import { buildSearchText } from "@/lib/search/normalize";
import { replaceItemTags, tagsForItems } from "@/lib/tags";

export type ItemRow = typeof items.$inferSelect;
export type { ItemContent } from "@/lib/item-content";
const MERGE_WINDOW_MS = 5 * 60 * 1000;

/** snapshot ใน item_versions (§6.2): title, summary, body, kinds, tags (snapshot ก่อน 0003 มี url/scriptMeta/codeBlocks แทน kinds) */
const snapshot = (p: PreparedContent) => ({ title: p.title, summary: p.summary, body: p.body, kinds: p.kinds, tags: p.tags.map((t) => t.name) });

const tagTerms = (list: { name: string; slug: string }[]) => list.flatMap((t) => (t.name.toLowerCase() === t.slug ? [t.slug] : [t.name, t.slug]));

const searchText = (p: PreparedContent, attachmentNames: string[] = []) => buildSearchText({
  title: p.title, summary: p.summary, body: p.body, attachmentNames, tagNames: tagTerms(p.tags),
});

async function attachmentNamesOf(tx: Pick<Tx, "select">, itemId: string): Promise<string[]> {
  const rows = await tx.select({ n: attachments.originalName }).from(attachments)
    .where(and(eq(attachments.itemId, itemId), isNull(attachments.deletedAt))).orderBy(asc(attachments.createdAt));
  return rows.map((r) => r.n);
}

/** สร้าง search_text ใหม่เมื่อไฟล์แนบเปลี่ยน (ไม่แตะ version/updated_at) — เรียกใน transaction เดียวกับการเปลี่ยนไฟล์แนบ */
export async function refreshSearchText(tx: Tx, itemId: string) {
  const [r] = await tx.select().from(items).where(eq(items.id, itemId));
  if (!r) return;
  const tagMap = await tagsForItems(tx, [itemId]);
  const text = buildSearchText({
    title: r.title, summary: r.summary, body: r.body,
    attachmentNames: await attachmentNamesOf(tx, itemId), tagNames: tagTerms(tagMap.get(itemId) ?? []),
  });
  await tx.update(items).set({ searchText: text }).where(eq(items.id, itemId));
}

export async function loadItem(x: Pick<Tx, "select">, ctx: Ctx, id: string): Promise<ItemRow> {
  if (!isUuid(id)) throw notFound();
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
  ctx: Ctx, input: ItemContent & { collectionId?: string | null; visibility?: Setting }, req: Request | null,
) {
  const p = prepareContent(input);
  return db().transaction(async (tx) => {
    const collectionId = input.collectionId ?? null;
    const { visibility, effective } = await effectiveFor(tx, ctx, collectionId, input.visibility ?? "inherit");
    const id = uuidv7();
    await tx.insert(items).values({
      id, workspaceId: ctx.workspaceId, collectionId, title: p.title, summary: p.summary, body: p.body, kinds: p.kinds,
      ownerId: ctx.userId, visibility, effectiveVisibility: effective, searchText: searchText(p), updatedBy: ctx.userId,
    });
    await replaceItemTags(tx, ctx, id, p.tags);
    await tx.insert(itemVersions).values({ itemId: id, version: 1, snapshot: snapshot(p), editedBy: ctx.userId });
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "item.created", targetType: "item", targetId: id, after: { kinds: p.kinds, title: p.title, visibility } });
    return id;
  });
}

export type UpdateOpts = {
  /** ไม่รวมกับเวอร์ชันล่าสุดแม้เป็นคนเดิมภายใน 5 นาที (ใช้ตอนกู้เวอร์ชัน: ต้องเกิดเวอร์ชันใหม่เสมอ) */
  noMerge?: boolean;
  action?: string;
  auditExtra?: Record<string, unknown>;
};

export async function updateItem(ctx: Ctx, id: string, input: ItemContent & { version: number }, req: Request | null, opts: UpdateOpts = {}) {
  if (!isUuid(id)) throw notFound();
  return db().transaction(async (tx) => {
    const [locked] = await tx.select().from(items).where(and(eq(items.id, id), eq(items.workspaceId, ctx.workspaceId))).for("update");
    if (!locked || !canView(ctx, locked)) throw notFound();
    if (!canEdit(ctx, locked)) throw new AppError(403, "forbidden");
    // optimistic locking: ถ้ามีคนแก้ไปก่อน ส่ง 409 พร้อมสถานะปัจจุบันให้ UI แสดง dialog (§1.1)
    if (locked.version !== input.version) {
      const [lastEdit] = await tx.select({ by: users.displayName, at: itemVersions.createdAt }).from(itemVersions)
        .innerJoin(users, eq(users.id, itemVersions.editedBy)).where(eq(itemVersions.itemId, id)).orderBy(desc(itemVersions.version)).limit(1);
      const tagMap = await tagsForItems(tx, [id]);
      throw new AppError(409, "version_conflict", {
        current: {
          version: locked.version, title: locked.title, summary: locked.summary, body: locked.body, kinds: locked.kinds,
          tags: (tagMap.get(id) ?? []).map((t) => t.name), editedBy: lastEdit?.by ?? null, editedAt: lastEdit?.at ?? null,
        },
      });
    }
    const p = prepareContent(input);

    const next = locked.version + 1;
    await tx.update(items).set({
      title: p.title, summary: p.summary, body: p.body, kinds: p.kinds,
      version: next, searchText: searchText(p, await attachmentNamesOf(tx, id)), updatedBy: ctx.userId, updatedAt: new Date(),
    }).where(eq(items.id, id));
    await replaceItemTags(tx, ctx, id, p.tags);

    // แก้ต่อเนื่องโดยคนเดิมภายใน 5 นาที รวมเป็นเวอร์ชันเดียว (§10.1)
    const [last] = await tx.select().from(itemVersions).where(eq(itemVersions.itemId, id)).orderBy(desc(itemVersions.version)).limit(1);
    if (!opts.noMerge && last && last.editedBy === ctx.userId && Date.now() - last.createdAt.getTime() < MERGE_WINDOW_MS) {
      await tx.update(itemVersions).set({ version: next, snapshot: snapshot(p) }).where(eq(itemVersions.id, last.id));
    } else {
      await tx.insert(itemVersions).values({ itemId: id, version: next, snapshot: snapshot(p), editedBy: ctx.userId });
    }
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: opts.action ?? "item.updated", targetType: "item", targetId: id, after: { version: next, ...opts.auditExtra } });
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

export type ItemDetail = Omit<ItemRow, "searchText" | "kinds"> & {
  kinds: Kind[];
  tags: { name: string; slug: string }[];
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
  const tagMap = await tagsForItems(db(), [r.id]);
  const { searchText: _omit, ...rest } = r;
  void _omit;
  return { ...rest, kinds: r.kinds as Kind[], tags: tagMap.get(r.id) ?? [], ownerName: o?.n ?? "—", canEdit: canEdit(ctx, r), canManage: canManage(ctx, r), breadcrumb: crumbs };
}

export type ListScope = { kind: "collection"; id: string } | { kind: "inbox" } | { kind: "mine" } | { kind: "recent" };
export type ItemSummary = {
  id: string; kinds: Kind[]; title: string; summary: string | null; updatedAt: Date;
  ownerName: string; effectiveVisibility: Effective; collectionId: string | null; tags: string[];
};
export type ListFilter = { kind?: Kind; tag?: string; limit?: number; offset?: number };

/** รายการตาม scope — ทุก query ผ่าน visibleItemsWhere (กรองสิทธิ์ตั้งแต่ใน SQL) */
export async function listItems(ctx: Ctx, scope: ListScope, opts: ListFilter = {}): Promise<ItemSummary[]> {
  const extra =
    scope.kind === "collection" ? eq(items.collectionId, scope.id)
    : scope.kind === "inbox" ? sql`${items.collectionId} IS NULL`
    : scope.kind === "mine" ? eq(items.ownerId, ctx.userId)
    : undefined;
  const byTag = opts.tag
    ? sql`EXISTS (SELECT 1 FROM ${itemTags} JOIN ${tags} ON ${tags.id} = ${itemTags.tagId} WHERE ${itemTags.itemId} = ${items.id} AND ${tags.slug} = ${opts.tag})`
    : undefined;
  const rows = await db().select({
    id: items.id, kinds: items.kinds, title: items.title, summary: items.summary, updatedAt: items.updatedAt,
    ownerName: users.displayName, effectiveVisibility: items.effectiveVisibility, collectionId: items.collectionId,
  }).from(items).innerJoin(users, eq(users.id, items.ownerId))
    .where(and(visibleItemsWhere(ctx), extra, opts.kind ? sql`${items.kinds} @> ARRAY[${opts.kind}]::text[]` : undefined, byTag))
    .orderBy(desc(items.updatedAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
  const tagMap = await tagsForItems(db(), rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, kinds: r.kinds as Kind[], tags: (tagMap.get(r.id) ?? []).map((t) => t.name) }));
}
