import { ItemList } from "@/components/ItemRow";
import { requireCtx } from "@/lib/auth/session";
import { listItems } from "@/lib/items";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const { ctx } = await requireCtx();
  const { t } = await getT();
  const items = await listItems(ctx, { kind: "inbox" });
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("nav.inbox")}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{t("inbox.desc")}</p>
      <ItemList items={items} empty={t("common.noItems")} />
    </>
  );
}
