import { ItemList } from "@/components/ItemRow";
import { requireCtx } from "@/lib/auth/session";
import { listItems } from "@/lib/items";

export default async function Page() {
  const { ctx } = await requireCtx();
  const items = await listItems(ctx, { kind: "mine" });
  return (
    <>
      <h1 className="text-2xl font-semibold">ของฉัน</h1>
      <p className="mb-5 mt-1 text-sm text-muted">รายการที่คุณเป็นเจ้าของ</p>
      <ItemList items={items} empty="ยังไม่มีรายการ" />
    </>
  );
}
