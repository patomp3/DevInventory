import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { deleteItem, getItemDetail, updateItem } from "@/lib/items";

const body = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(500).nullish(),
  body: z.string().max(200_000).nullish(),
  url: z.string().max(2000).nullish(),
});

export const GET = userRoute<{ id: string }>(async ({ ctx, params }) => {
  const { canEdit, canManage, ...item } = await getItemDetail(ctx, params.id);
  return json({ item, permissions: { canEdit, canManage } });
});

export const PUT = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  return json({ version: await updateItem(ctx, params.id, p.data, req) });
});

export const DELETE = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  await deleteItem(ctx, params.id, req);
  return json({ ok: true });
});
