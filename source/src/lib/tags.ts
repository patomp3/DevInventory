// Tag (design.md §6.2, §8.7) — autocomplete/tag cloud ต้องนับเฉพาะรายการที่ผู้ใช้มีสิทธิ์เห็น
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/lib/collections";
import { db } from "@/lib/db";
import { itemTags, items, tags } from "@/lib/db/schema";
import { normalizeTag } from "@/lib/item-content";
import { visibleItemsWhere, type Ctx } from "@/lib/permissions";
import { likePattern } from "@/lib/search/normalize";

/** แทนที่ tag ทั้งหมดของรายการ (สร้าง tag ใหม่ใน workspace ถ้ายังไม่มี) — เรียกใน transaction เดียวกับการบันทึกรายการ */
export async function replaceItemTags(tx: Tx, ctx: Ctx, itemId: string, list: { name: string; slug: string }[]) {
  await tx.delete(itemTags).where(eq(itemTags.itemId, itemId));
  if (!list.length) return [];
  await tx.insert(tags).values(list.map((t) => ({ workspaceId: ctx.workspaceId, name: t.name, slug: t.slug })))
    .onConflictDoNothing({ target: [tags.workspaceId, tags.slug] });
  const rows = await tx.select({ id: tags.id, name: tags.name, slug: tags.slug }).from(tags)
    .where(and(eq(tags.workspaceId, ctx.workspaceId), inArray(tags.slug, list.map((t) => t.slug))));
  await tx.insert(itemTags).values(rows.map((r) => ({ itemId, tagId: r.id })));
  return rows;
}

/** tag ของหลายรายการ (ids ต้องผ่าน visibleItemsWhere มาแล้ว) */
export async function tagsForItems(x: Pick<Tx, "select">, itemIds: string[]): Promise<Map<string, { name: string; slug: string }[]>> {
  const out = new Map<string, { name: string; slug: string }[]>();
  if (!itemIds.length) return out;
  const rows = await x.select({ itemId: itemTags.itemId, name: tags.name, slug: tags.slug }).from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId)).where(inArray(itemTags.itemId, itemIds)).orderBy(asc(tags.slug));
  for (const r of rows) {
    const l = out.get(r.itemId) ?? [];
    l.push({ name: r.name, slug: r.slug });
    out.set(r.itemId, l);
  }
  return out;
}

export type TagCount = { name: string; slug: string; count: number };

/**
 * autocomplete (`?prefix=`) และ tag ยอดนิยม (ไม่ส่ง prefix)
 * แสดงเฉพาะ tag ที่ผูกกับรายการที่ผู้ใช้มีสิทธิ์เห็นอย่างน้อย 1 รายการ และนับเฉพาะรายการเหล่านั้น (§8.7)
 */
export async function listTags(ctx: Ctx, opts: { prefix?: string; limit?: number } = {}): Promise<TagCount[]> {
  const q = normalizeTag(opts.prefix ?? "");
  const count = sql<number>`count(distinct ${items.id})::int`;
  return db().select({ name: tags.name, slug: tags.slug, count }).from(tags)
    .innerJoin(itemTags, eq(itemTags.tagId, tags.id))
    .innerJoin(items, eq(items.id, itemTags.itemId))
    .where(and(eq(tags.workspaceId, ctx.workspaceId), visibleItemsWhere(ctx), q ? sql`${tags.slug} LIKE ${likePattern(q)}` : undefined))
    .groupBy(tags.id, tags.name, tags.slug)
    // ขึ้นต้นด้วยคำที่พิมพ์มาก่อน แล้วค่อยเรียงตามจำนวน
    .orderBy(...(q ? [sql`${tags.slug} NOT LIKE ${likePattern(q).slice(1)}`] : []), desc(count), asc(tags.slug))
    .limit(Math.min(opts.limit ?? 10, 50));
}
