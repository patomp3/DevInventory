import Link from "next/link";
import { ItemList } from "@/components/ItemRow";
import { requireCtx } from "@/lib/auth/session";
import { listItems } from "@/lib/items";
import { listTags } from "@/lib/tags";

export default async function Home() {
  const { ctx } = await requireCtx();
  const [recent, mine, tags] = await Promise.all([
    listItems(ctx, { kind: "recent" }, { limit: 10 }),
    listItems(ctx, { kind: "mine" }, { limit: 5 }),
    listTags(ctx, { limit: 15 }),
  ]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">หน้าแรก</h1>
        <p className="mt-1 text-sm text-muted">แสดงเฉพาะรายการที่คุณมีสิทธิ์เห็น</p>
      </div>
      <div className="flex flex-wrap gap-8">
        <div className="min-w-0 flex-[999_1_480px] space-y-8">
          <section aria-labelledby="h-recent">
            <h2 id="h-recent" className="mb-2 text-[13px] font-semibold text-muted">แก้ไขล่าสุดในทีม</h2>
            <ItemList items={recent} empty="ยังไม่มีรายการ — กด “+ สร้างใหม่” เพื่อเริ่มต้น" />
          </section>
          <section aria-labelledby="h-mine">
            <h2 id="h-mine" className="mb-2 text-[13px] font-semibold text-muted">ของฉันล่าสุด</h2>
            <ItemList items={mine} empty="คุณยังไม่ได้สร้างรายการ" />
          </section>
        </div>
        <section aria-labelledby="h-tags" className="flex-[1_1_240px] lg:max-w-[340px]">
          <h2 id="h-tags" className="mb-2 text-[13px] font-semibold text-muted">Tag ที่ใช้บ่อย</h2>
          {tags.length === 0 ? <p className="text-sm text-muted">ยังไม่มี tag</p> : (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t.slug}>
                  <Link href={`/search?tag=${encodeURIComponent(t.slug)}`} className="inline-flex items-center gap-1.5 rounded-md bg-surface-hover px-2 py-1 text-xs text-text-2 hover:text-text">
                    #{t.name}<span className="font-mono text-[11px] text-muted">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
