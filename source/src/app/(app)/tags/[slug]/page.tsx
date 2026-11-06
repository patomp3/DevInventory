import { ItemList } from "@/components/ItemRow";
import { requireCtx } from "@/lib/auth/session";
import { normalizeTag } from "@/lib/item-content";
import { listItems } from "@/lib/items";

/** รายการที่มี tag นี้ (เฉพาะที่ผู้ใช้มีสิทธิ์เห็น) — หน้าค้นหาเต็มรูปแบบมาในสัปดาห์ 6 */
export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ctx } = await requireCtx();
  const tag = normalizeTag(decodeURIComponent(slug));
  const items = tag ? await listItems(ctx, { kind: "recent" }, { tag, limit: 100 }) : [];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">#{tag}</h1>
        <p className="mt-1 text-sm text-muted">แสดงเฉพาะรายการที่คุณมีสิทธิ์เห็น · {items.length} รายการ</p>
      </div>
      <ItemList items={items} empty="ไม่มีรายการที่มี tag นี้" />
    </div>
  );
}
