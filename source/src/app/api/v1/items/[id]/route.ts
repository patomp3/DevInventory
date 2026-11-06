import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { updateItemBody } from "@/lib/item-schema";
import { deleteItem, getItemDetail, updateItem } from "@/lib/items";

export const GET = userRoute<{ id: string }>(async ({ ctx, params }) => {
  const { canEdit, canManage, ...item } = await getItemDetail(ctx, params.id);
  return json({ item, permissions: { canEdit, canManage } });
});

export const PUT = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const p = updateItemBody.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  return json({ version: await updateItem(ctx, params.id, p.data, req) });
});

export const DELETE = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  await deleteItem(ctx, params.id, req);
  return json({ ok: true });
});
