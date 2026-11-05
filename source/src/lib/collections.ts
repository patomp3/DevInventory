// Collection tree + การสืบทอดสิทธิ์ (design.md §4.4, §7.3)
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { collections, items, workspaces } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { canEdit, canManage, canView, resolveEffective, visibleItemsWhere, type Ctx, type Effective, type Setting } from "@/lib/permissions";

export type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
export type CollectionRow = typeof collections.$inferSelect;
const MAX_DEPTH = 3;

export async function workspaceDefault(x: Pick<Tx, "select">, workspaceId: string): Promise<Effective> {
  const [w] = await x.select({ v: workspaces.defaultVisibility }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return w?.v ?? "workspace_view";
}

export async function loadCollection(x: Pick<Tx, "select">, ctx: Ctx, id: string): Promise<CollectionRow> {
  const [c] = await x.select().from(collections).where(and(eq(collections.id, id), eq(collections.workspaceId, ctx.workspaceId)));
  if (!c || !canView(ctx, c)) throw notFound();
  return c;
}

/** คำนวณ effective_visibility ใหม่ทั้งสาย (collection ลูก + รายการที่ inherit) ภายใน transaction เดียวกัน */
export async function recomputeSubtree(tx: Tx, collectionId: string, wsDefault: Effective) {
  const [c] = await tx.select().from(collections).where(eq(collections.id, collectionId));
  if (!c) return;
  let parentEff: Effective | null = null;
  if (c.parentId) {
    const [p] = await tx.select({ e: collections.effectiveVisibility }).from(collections).where(eq(collections.id, c.parentId));
    parentEff = p?.e ?? null;
  }
  const eff = resolveEffective(c.visibility, parentEff, wsDefault);
  await tx.update(collections).set({ effectiveVisibility: eff, updatedAt: new Date() }).where(eq(collections.id, c.id));
  await tx.update(items).set({ effectiveVisibility: eff }).where(and(eq(items.collectionId, c.id), eq(items.visibility, "inherit")));
  const kids = await tx.select({ id: collections.id }).from(collections).where(eq(collections.parentId, c.id));
  for (const k of kids) await recomputeSubtree(tx, k.id, wsDefault);
}

async function subtreeHeight(x: Pick<Tx, "select">, id: string): Promise<number> {
  const kids = await x.select({ id: collections.id }).from(collections).where(and(eq(collections.parentId, id), isNull(collections.deletedAt)));
  let h = 0;
  for (const k of kids) h = Math.max(h, await subtreeHeight(x, k.id));
  return kids.length ? h + 1 : 0;
}

async function setDepths(tx: Tx, id: string, depth: number) {
  await tx.update(collections).set({ depth }).where(eq(collections.id, id));
  const kids = await tx.select({ id: collections.id }).from(collections).where(eq(collections.parentId, id));
  for (const k of kids) await setDepths(tx, k.id, depth + 1);
}

// ---------- tree ----------

export type TreeNode = { id: string; name: string; icon: string | null; parentId: string | null; depth: number; effectiveVisibility: Effective; count: number };

/** Collection ที่ผู้ใช้เห็น + จำนวนรายการที่ "มีสิทธิ์เห็น" (รวมลูกหลาน ใช้ predicate 7.2 ตัวเดียวกับค้นหา) */
export async function listTree(ctx: Ctx): Promise<TreeNode[]> {
  const all = await db().select().from(collections).where(and(eq(collections.workspaceId, ctx.workspaceId), isNull(collections.deletedAt)));
  const counts = await db().select({ id: items.collectionId, n: sql<number>`count(*)::int` })
    .from(items).where(visibleItemsWhere(ctx)).groupBy(items.collectionId);
  const own = new Map(counts.map((r) => [r.id, r.n]));
  const byId = new Map(all.map((c) => [c.id, c]));
  const total = new Map<string, number>();
  for (const c of all) {
    const n = own.get(c.id) ?? 0;
    for (let cur: CollectionRow | undefined = c; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      total.set(cur.id, (total.get(cur.id) ?? 0) + n);
    }
  }
  const visible = all.filter((c) => canView(ctx, c));
  const visIds = new Set(visible.map((c) => c.id));
  return visible
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th"))
    .map((c) => ({
      id: c.id, name: c.name, icon: c.icon, depth: c.depth, effectiveVisibility: c.effectiveVisibility, count: total.get(c.id) ?? 0,
      // ถ้าแม่มองไม่เห็น ให้ขึ้นเป็นระดับบนสุด (ไม่เปิดเผยชื่อแม่)
      parentId: c.parentId && visIds.has(c.parentId) ? c.parentId : null,
    }));
}

// ---------- CRUD ----------

export type CollectionInput = { name: string; description?: string | null; icon?: string | null; parentId?: string | null; visibility?: Setting };

export async function createCollection(ctx: Ctx, input: CollectionInput, req: Request | null) {
  return db().transaction(async (tx) => {
    const wsDefault = await workspaceDefault(tx, ctx.workspaceId);
    let parent: CollectionRow | null = null;
    if (input.parentId) {
      parent = await loadCollection(tx, ctx, input.parentId);
      if (!canEdit(ctx, parent)) throw new AppError(403, "forbidden");
      if (parent.depth >= MAX_DEPTH) throw new AppError(422, "max_depth");
    }
    // ระดับบนสุดต้องตั้งค่าเอง (§4.4.1)
    const visibility: Setting = input.visibility ?? (parent ? "inherit" : wsDefault);
    if (!parent && visibility === "inherit") throw new AppError(422, "top_level_cannot_inherit");
    const id = uuidv7();
    await tx.insert(collections).values({
      id, workspaceId: ctx.workspaceId, parentId: parent?.id ?? null, depth: (parent?.depth ?? 0) + 1,
      name: input.name, description: input.description ?? null, icon: input.icon ?? null, ownerId: ctx.userId,
      visibility, effectiveVisibility: resolveEffective(visibility, parent?.effectiveVisibility ?? null, wsDefault),
    });
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "collection.created", targetType: "collection", targetId: id, after: { name: input.name, visibility } });
    return id;
  });
}

export async function updateCollection(
  ctx: Ctx, id: string,
  patch: { name?: string; description?: string | null; icon?: string | null; visibility?: Setting; parentId?: string | null },
  req: Request | null,
) {
  await db().transaction(async (tx) => {
    const c = await loadCollection(tx, ctx, id);
    if (!canManage(ctx, c)) throw new AppError(403, "forbidden");
    const wsDefault = await workspaceDefault(tx, ctx.workspaceId);
    const newParentId = patch.parentId === undefined ? c.parentId : patch.parentId;
    const visibility = patch.visibility ?? c.visibility;

    if (newParentId !== c.parentId) {
      let parent: CollectionRow | null = null;
      if (newParentId) {
        parent = await loadCollection(tx, ctx, newParentId);
        if (!canEdit(ctx, parent)) throw new AppError(403, "forbidden");
        // ห้ามย้ายเข้าไปอยู่ใต้ตัวเอง
        for (let cur: CollectionRow | undefined = parent; cur; ) {
          if (cur.id === c.id) throw new AppError(422, "cycle");
          cur = cur.parentId ? (await tx.select().from(collections).where(eq(collections.id, cur.parentId)))[0] : undefined;
        }
      }
      const newDepth = (parent?.depth ?? 0) + 1;
      if (newDepth + (await subtreeHeight(tx, c.id)) > MAX_DEPTH) throw new AppError(422, "max_depth");
      if (!parent && visibility === "inherit") throw new AppError(422, "top_level_cannot_inherit");
      await tx.update(collections).set({ parentId: parent?.id ?? null }).where(eq(collections.id, c.id));
      await setDepths(tx, c.id, newDepth);
    } else if (!c.parentId && visibility === "inherit") {
      throw new AppError(422, "top_level_cannot_inherit");
    }

    await tx.update(collections).set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      visibility, updatedAt: new Date(),
    }).where(eq(collections.id, c.id));
    await recomputeSubtree(tx, c.id, wsDefault);

    if (visibility !== c.visibility) {
      await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "collection.visibility_changed", targetType: "collection", targetId: c.id, before: { visibility: c.visibility }, after: { visibility } });
    }
    if (newParentId !== c.parentId) {
      await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "collection.moved", targetType: "collection", targetId: c.id, before: { parentId: c.parentId }, after: { parentId: newParentId } });
    }
    if (patch.name !== undefined && patch.name !== c.name) {
      await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "collection.renamed", targetType: "collection", targetId: c.id, before: { name: c.name }, after: { name: patch.name } });
    }
  });
}

/** ลบได้เฉพาะ Collection ว่าง (ไม่มีรายการ/ลูก) — กันรายการหายจากมุมมองโดยไม่ตั้งใจ */
export async function deleteCollection(ctx: Ctx, id: string, req: Request | null) {
  await db().transaction(async (tx) => {
    const c = await loadCollection(tx, ctx, id);
    if (!canManage(ctx, c)) throw new AppError(403, "forbidden");
    const [kid] = await tx.select({ id: collections.id }).from(collections).where(and(eq(collections.parentId, id), isNull(collections.deletedAt))).limit(1);
    const [it] = await tx.select({ id: items.id }).from(items).where(and(eq(items.collectionId, id), isNull(items.deletedAt))).limit(1);
    if (kid || it) throw new AppError(409, "not_empty");
    await tx.update(collections).set({ deletedAt: new Date() }).where(eq(collections.id, id));
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "collection.deleted", targetType: "collection", targetId: id, before: { name: c.name } });
  });
}

/** Collection ที่ผู้ใช้ "เพิ่มรายการได้" (canEdit) ใช้ใน dropdown ของ editor */
export async function listWritableCollections(ctx: Ctx) {
  const tree = await listTree(ctx);
  const rows = tree.length ? await db().select().from(collections).where(inArray(collections.id, tree.map((t) => t.id))) : [];
  const ok = new Set(rows.filter((c) => canEdit(ctx, c)).map((c) => c.id));
  return tree.filter((t) => ok.has(t.id));
}


