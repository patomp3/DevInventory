import { ItemList } from "@/components/ItemRow";
import { requireCtx } from "@/lib/auth/session";
import { listItems } from "@/lib/items";

export default async function Home() {
  const { ctx } = await requireCtx();
  const [recent, mine] = await Promise.all([listItems(ctx, { kind: "recent" }, { limit: 10 }), listItems(ctx, { kind: "mine" }, { limit: 5 })]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">หน้าแรก</h1>
        <p className="mt-1 text-sm text-muted">แสดงเฉพาะรายการที่คุณมีสิทธิ์เห็น</p>
      </div>
      <section aria-labelledby="h-recent">
        <h2 id="h-recent" className="mb-2 text-[13px] font-semibold text-muted">แก้ไขล่าสุดในทีม</h2>
        <ItemList items={recent} empty="ยังไม่มีรายการ — กด “+ สร้างใหม่” เพื่อเริ่มต้น" />
      </section>
      <section aria-labelledby="h-mine">
        <h2 id="h-mine" className="mb-2 text-[13px] font-semibold text-muted">ของฉันล่าสุด</h2>
        <ItemList items={mine} empty="คุณยังไม่ได้สร้างรายการ" />
      </section>
    </div>
  );
}
