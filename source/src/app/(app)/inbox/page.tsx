import { ItemList } from "@/components/ItemRow";
import { requireCtx } from "@/lib/auth/session";
import { listItems } from "@/lib/items";

export default async function Page() {
  const { ctx } = await requireCtx();
  const items = await listItems(ctx, { kind: "inbox" });
  return (
    <>
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <p className="mb-5 mt-1 text-sm text-muted">รายการที่ไม่ได้อยู่ใน Collection</p>
      <ItemList items={items} empty="ยังไม่มีรายการ" />
    </>
  );
}
