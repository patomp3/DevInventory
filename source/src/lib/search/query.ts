// ค้นหา (design.md §8.4–8.7): ทุก query กรองสิทธิ์ด้วย visibleItemsWhere ใน SQL — รวม total, facet, คำแนะนำ, quick (กฎข้อ 1)
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, itemTags, items, tags, users } from "@/lib/db/schema";
import { isKind, normalizeTag, type Kind } from "@/lib/item-content";
import { canView, visibleItemsWhere, type Ctx, type Effective } from "@/lib/permissions";
import { likePattern, parseQuery, type ParsedQuery } from "@/lib/search/normalize";
import { buildResultSnippet, type ResultSnippet } from "@/lib/search/snippet";

export const PAGE_SIZE = 20;
export const QUICK_LIMIT = 8;
export const MAX_QUERY_CHARS = 200;
const MAX_TERMS = 12;

export type SearchInput = { q?: string; kind?: string; tag?: string; lang?: string; page?: number };
export type SearchHit = {
  id: string; title: string; summary: string | null; kinds: Kind[]; tags: string[]; updatedAt: Date; ownerName: string;
  effectiveVisibility: Effective; breadcrumb: { id: string; name: string }[]; snippet: ResultSnippet;
};
export type Facet = { value: string; label: string; count: number };
export type SearchResult = {
  total: number; page: number; pageSize: number; terms: string[]; parsed: ParsedQuery; hits: SearchHit[];
  facets: { kinds: Facet[]; tags: Facet[]; langs: Facet[] };
  didYouMean: { label: string; q: string }[];
};

/** รวมตัวกรองจาก UI (kind/tag/lang) เข้ากับคำค้น แล้ว parse เป็นไวยากรณ์เดียว (design §8.3) */
export function mergeQuery(i: SearchInput): ParsedQuery {
  const raw = (i.q ?? "").slice(0, MAX_QUERY_CHARS);
  const extra = [i.kind && isKind(i.kind) ? `kind:${i.kind}` : "", i.tag ? `tag:${normalizeTag(i.tag)}` : "", i.lang ? `lang:${i.lang.replace(/\s/g, "")}` : ""];
  const p = parseQuery([raw, ...extra].filter(Boolean).join(" "));
  p.terms = p.terms.slice(0, MAX_TERMS);
  p.phrases = p.phrases.slice(0, MAX_TERMS);
  p.excluded = p.excluded.slice(0, MAX_TERMS);
  return p;
}

const hasFilters = (p: ParsedQuery) => p.types.length + p.tags.length + p.langs.length + p.collections.length > 0 || p.ownerMe || p.isPrivate;
export const isEmptyQuery = (p: ParsedQuery) => !p.terms.length && !p.phrases.length && !p.excluded.length && !hasFilters(p);
/** คำที่ใช้ไฮไลต์: คำปกติ + วลี (ไม่รวมคำที่ตัดออก) */
export const highlightTerms = (p: ParsedQuery) => [...p.phrases, ...p.terms];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** เงื่อนไข WHERE ทั้งหมด; skip = ข้ามตัวกรองหนึ่งมิติ (ใช้นับ facet ของมิตินั้น) */
function conditions(ctx: Ctx, p: ParsedQuery, skip?: "kind" | "tag" | "lang"): SQL[] {
  const c: SQL[] = [visibleItemsWhere(ctx)];
  for (const t of [...p.terms, ...p.phrases]) c.push(sql`${items.searchText} LIKE ${likePattern(t)}`);
  for (const t of p.excluded) c.push(sql`${items.searchText} NOT LIKE ${likePattern(t)}`);
  if (skip !== "kind") for (const k of p.types) c.push(sql`${items.kinds} @> ARRAY[${k}]::text[]`);
  if (skip !== "tag") {
    for (const t of p.tags) {
      c.push(sql`EXISTS (SELECT 1 FROM ${itemTags} JOIN ${tags} ON ${tags.id} = ${itemTags.tagId} WHERE ${itemTags.itemId} = ${items.id} AND ${tags.slug} = ${normalizeTag(t)})`);
    }
  }
  if (skip !== "lang") {
    for (const l of p.langs) c.push(sql`lower(${items.body}) ~ ${"(^|\n)[ ]{0,3}`{3,}" + escapeRegex(l) + "([^a-z0-9_+#.-]|$)"}`);
  }
  if (p.ownerMe) c.push(eq(items.ownerId, ctx.userId));
  if (p.isPrivate) c.push(sql`${items.ownerId} = ${ctx.userId} AND ${items.effectiveVisibility} = 'private'`);
  if (p.collections.length) {
    // in:"ชื่อ" รวม sub-collection; นับเฉพาะ Collection ที่ผู้ใช้มีสิทธิ์เห็น (ไม่ให้เดาโครงสร้าง Collection ที่ซ่อนอยู่)
    const names = sql.join(p.collections.map((n) => sql`${n}`), sql`, `);
    c.push(sql`${items.collectionId} IN (
      WITH RECURSIVE sub AS (
        SELECT c.id FROM ${collections} c
        WHERE c.workspace_id = ${ctx.workspaceId} AND c.deleted_at IS NULL AND lower(c.name) IN (${names})
          AND (c.owner_id = ${ctx.userId} OR c.effective_visibility <> 'private')
        UNION ALL
        SELECT c.id FROM ${collections} c JOIN sub ON c.parent_id = sub.id
        WHERE c.deleted_at IS NULL AND (c.owner_id = ${ctx.userId} OR c.effective_visibility <> 'private')
      ) SELECT id FROM sub)`);
  }
  return c;
}

/**
 * คะแนน (§8.4): ชื่อเรื่องมีคำแรก 10 + คำอื่นในชื่อคำละ 3 + tag ตรงคำแรก 6 + คำอธิบายสั้นมีคำแรก 2
 * + 4 × สัดส่วนที่คำค้นครอบคลุมชื่อ (ชื่อสั้นที่ตรงเต็มจึงขึ้นก่อน)
 * ไม่ใช้ word_similarity: ทุกผลผ่าน LIKE ครบทุกคำแล้ว และ pg_trgm ภายใต้ ICU th-TH ช้า (วัดที่ 50,000 แถว:
 * word_similarity ของ search_text ≈ 390 ms, ของชื่อ ≈ 150 ms จากทั้ง query ≈ 550 ms)
 */
function scoreSql(p: ParsedQuery): SQL<number> {
  const words = [...p.terms, ...p.phrases];
  if (!words.length) return sql<number>`0`;
  const first = words[0]!;
  const inTitle = (w: string) => sql`(CASE WHEN lower(${items.title}) LIKE ${likePattern(w)} THEN 1 ELSE 0 END)`;
  const covered = words.reduce((n, w) => n + [...w].length, 0);
  return sql<number>`(
    10 * ${inTitle(first)}
    + ${words.length > 1 ? sql.join(words.slice(1).map((w) => sql`3 * ${inTitle(w)}`), sql` + `) : sql`0`}
    + CASE WHEN EXISTS (SELECT 1 FROM ${itemTags} JOIN ${tags} ON ${tags.id} = ${itemTags.tagId}
        WHERE ${itemTags.itemId} = ${items.id} AND ${tags.slug} = ${normalizeTag(first)}) THEN 6 ELSE 0 END
    + CASE WHEN lower(coalesce(${items.summary}, '')) LIKE ${likePattern(first)} THEN 2 ELSE 0 END
    + 4 * least(1.0, ${covered}::float8 / greatest(char_length(${items.title}), 1))
  )::float8`;
}

async function breadcrumbFor(ctx: Ctx, ids: (string | null)[]): Promise<Map<string, { id: string; name: string }[]>> {
  const out = new Map<string, { id: string; name: string }[]>();
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  if (!uniq.length) return out;
  // Collection ลึกไม่เกิน 3 ชั้น: โหลดทั้ง workspace ครั้งเดียว (เล็ก) แล้วไล่ขึ้น โดยหยุดเมื่อเจอชั้นที่ผู้ชมไม่มีสิทธิ์เห็น (§4.4.6)
  const rows = await db().select().from(collections).where(eq(collections.workspaceId, ctx.workspaceId));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of uniq) {
    const crumbs: { id: string; name: string }[] = [];
    for (let cur = byId.get(id); cur && canView(ctx, cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      crumbs.unshift({ id: cur.id, name: cur.name });
    }
    out.set(id, crumbs);
  }
  return out;
}

async function facets(ctx: Ctx, p: ParsedQuery) {
  const kindQ = db().execute(sql`
    SELECT k AS value, count(*)::int AS count FROM (SELECT unnest(${items.kinds}) AS k FROM ${items} WHERE ${and(...conditions(ctx, p, "kind"))}) s
    GROUP BY k ORDER BY count DESC`);
  const tagQ = db().select({ value: tags.slug, label: tags.name, count: sql<number>`count(DISTINCT ${items.id})::int` })
    .from(items).innerJoin(itemTags, eq(itemTags.itemId, items.id)).innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(and(...conditions(ctx, p, "tag"))).groupBy(tags.id, tags.slug, tags.name)
    .orderBy(desc(sql`count(DISTINCT ${items.id})`), tags.slug).limit(12);
  const langQ = db().execute(sql`
    SELECT lang AS value, count(DISTINCT id)::int AS count FROM (
      SELECT ${items.id} AS id, (regexp_matches(lower(${items.body}), '(?:^|\n)[ ]{0,3}\`{3,}([a-z0-9_+#.-]+)', 'g'))[1] AS lang
      FROM ${items} WHERE ${and(...conditions(ctx, p, "lang"))}) s
    GROUP BY lang ORDER BY count DESC, lang LIMIT 8`);
  const [kindRows, tagRows, langRows] = await Promise.all([kindQ, tagQ, langQ]); // ขนานกัน (pool 10)
  const rowsOf = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? []);
  return {
    kinds: rowsOf<{ value: string; count: number }>(kindRows).filter((r) => isKind(r.value)).map((r) => ({ value: r.value, label: r.value, count: r.count })),
    tags: tagRows.map((r) => ({ value: r.value, label: r.label, count: r.count })),
    langs: rowsOf<{ value: string; count: number }>(langRows).map((r) => ({ value: r.value, label: r.value, count: r.count })),
  };
}

/** ไม่พบผล (เกณฑ์ tag 0.2 / ชื่อ 0.3): เสนอ tag ที่คล้ายและชื่อรายการที่คล้าย "คุณหมายถึง…" (เฉพาะที่ผู้ใช้เห็น — §8.4) */
async function suggest(ctx: Ctx, p: ParsedQuery): Promise<{ label: string; q: string }[]> {
  const words = [...p.terms, ...p.phrases];
  if (!words.length) return [];
  const q = words.join(" ");
  const tagRows = await db().select({ name: tags.name, slug: tags.slug, sim: sql<number>`max(similarity(${tags.slug}, ${normalizeTag(q)}))` })
    .from(tags).innerJoin(itemTags, eq(itemTags.tagId, tags.id)).innerJoin(items, eq(items.id, itemTags.itemId))
    .where(and(eq(tags.workspaceId, ctx.workspaceId), visibleItemsWhere(ctx), sql`similarity(${tags.slug}, ${normalizeTag(q)}) > 0.2`))
    .groupBy(tags.id, tags.name, tags.slug).orderBy(desc(sql`max(similarity(${tags.slug}, ${normalizeTag(q)}))`)).limit(3);
  const titleRows = await db().select({ title: items.title, sim: sql<number>`word_similarity(${q}, lower(${items.title}))` }).from(items)
    .where(and(visibleItemsWhere(ctx), sql`word_similarity(${q}, lower(${items.title})) > 0.3`))
    .orderBy(desc(sql`word_similarity(${q}, lower(${items.title}))`)).limit(3);
  return [
    ...tagRows.map((t) => ({ label: `#${t.name}`, q: `tag:${t.slug}` })),
    ...titleRows.map((t) => ({ label: t.title, q: t.title })),
  ];
}

/** ค้นหาเต็มรูปแบบ: ผล + total + facet จากเงื่อนไขชุดเดียวกัน (กรองสิทธิ์ใน SQL ทุกส่วน) */
export async function searchItems(ctx: Ctx, input: SearchInput): Promise<SearchResult> {
  const parsed = mergeQuery(input);
  const page = Math.max(0, Math.floor(input.page ?? 0));
  const empty: SearchResult = { total: 0, page, pageSize: PAGE_SIZE, terms: [], parsed, hits: [], facets: { kinds: [], tags: [], langs: [] }, didYouMean: [] };
  if (isEmptyQuery(parsed)) return empty;

  const score = scoreSql(parsed);
  const facetsP = facets(ctx, parsed); // เริ่มพร้อมกับ query หลัก
  const rows = await db().select({
    id: items.id, title: items.title, summary: items.summary, body: items.body, kinds: items.kinds, updatedAt: items.updatedAt,
    ownerName: users.displayName, effectiveVisibility: items.effectiveVisibility, collectionId: items.collectionId,
    score: score.as("score"), total: sql<number>`count(*) OVER ()::int`.as("total"),
  }).from(items).innerJoin(users, eq(users.id, items.ownerId))
    .where(and(...conditions(ctx, parsed)))
    .orderBy(sql`score DESC`, desc(items.updatedAt)).limit(PAGE_SIZE).offset(page * PAGE_SIZE);

  const total = rows[0]?.total ?? 0;
  const terms = highlightTerms(parsed);
  const [crumbs, tagRows, fac, didYouMean] = await Promise.all([
    breadcrumbFor(ctx, rows.map((r) => r.collectionId)),
    rows.length ? db().select({ itemId: itemTags.itemId, name: tags.name }).from(itemTags).innerJoin(tags, eq(tags.id, itemTags.tagId))
      .where(sql`${itemTags.itemId} IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`) : Promise.resolve([]),
    facetsP,
    total === 0 ? suggest(ctx, parsed) : Promise.resolve([]),
  ]);
  const tagsByItem = new Map<string, string[]>();
  for (const t of tagRows) tagsByItem.set(t.itemId, [...(tagsByItem.get(t.itemId) ?? []), t.name]);

  return {
    total, page, pageSize: PAGE_SIZE, terms, parsed, facets: fac, didYouMean,
    hits: rows.map((r) => ({
      id: r.id, title: r.title, summary: r.summary, kinds: r.kinds as Kind[], tags: tagsByItem.get(r.id) ?? [], updatedAt: r.updatedAt,
      ownerName: r.ownerName, effectiveVisibility: r.effectiveVisibility,
      breadcrumb: r.collectionId ? crumbs.get(r.collectionId) ?? [] : [],
      snippet: buildResultSnippet({ title: r.title, summary: r.summary, body: r.body }, terms), // สร้างหลังผ่านสิทธิ์แล้วเท่านั้น (§8.5)
    })),
  };
}

export type QuickHit = { id: string; title: string; kinds: Kind[]; breadcrumb: string | null };

/** ค้นด่วน (Ctrl+K): ชื่อเรื่องหรือ tag เท่านั้น สูงสุด 8 รายการ ผ่านสิทธิ์ใน SQL */
export async function quickSearch(ctx: Ctx, q: string): Promise<QuickHit[]> {
  const parsed = mergeQuery({ q });
  const words = [...parsed.terms, ...parsed.phrases];
  if (!words.length) return [];
  const per = words.map((w) => sql`(lower(${items.title}) LIKE ${likePattern(w)} OR EXISTS (
    SELECT 1 FROM ${itemTags} JOIN ${tags} ON ${tags.id} = ${itemTags.tagId} WHERE ${itemTags.itemId} = ${items.id} AND ${tags.slug} LIKE ${likePattern(normalizeTag(w))}))`);
  const rows = await db().select({ id: items.id, title: items.title, kinds: items.kinds, collectionId: items.collectionId })
    .from(items).where(and(visibleItemsWhere(ctx), ...per, ...parsed.excluded.map((t) => sql`${items.searchText} NOT LIKE ${likePattern(t)}`)))
    .orderBy(sql`(CASE WHEN lower(${items.title}) LIKE ${likePattern(words[0]!).slice(1)} THEN 0 ELSE 1 END)`, desc(items.updatedAt)).limit(QUICK_LIMIT);
  const crumbs = await breadcrumbFor(ctx, rows.map((r) => r.collectionId));
  return rows.map((r) => ({
    id: r.id, title: r.title, kinds: r.kinds as Kind[],
    breadcrumb: r.collectionId ? (crumbs.get(r.collectionId) ?? []).map((c) => c.name).join(" / ") || null : null,
  }));
}
