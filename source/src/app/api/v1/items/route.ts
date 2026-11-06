import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { isKind, normalizeTag } from "@/lib/item-content";
import { createItemBody } from "@/lib/item-schema";
import { createItem, listItems, type ListScope } from "@/lib/items";

const uuid = z.string().uuid();

/** GET /api/v1/items?collection=|scope=inbox|mine|recent &kind= &tag= &page= */
export const GET = userRoute(async ({ req, ctx }) => {
  const q = new URL(req.url).searchParams;
  const scopeName = q.get("scope") ?? "recent";
  let scope: ListScope;
  if (q.get("collection")) {
    if (!uuid.safeParse(q.get("collection")).success) throw new AppError(422, "validation");
    scope = { kind: "collection", id: q.get("collection")! };
  } else if (scopeName === "inbox" || scopeName === "mine" || scopeName === "recent") scope = { kind: scopeName };
  else throw new AppError(422, "validation");
  const kindRaw = q.get("kind");
  const kind = kindRaw && isKind(kindRaw) ? kindRaw : undefined;
  if (kindRaw && !kind) throw new AppError(422, "validation");
  const tag = q.get("tag") ? normalizeTag(q.get("tag")!) || undefined : undefined;
  const page = Math.max(0, Number(q.get("page") ?? 0) | 0);
  return json({ items: await listItems(ctx, scope, { kind, tag, limit: 50, offset: page * 50 }) });
});

export const POST = userRoute(async ({ req, ctx }) => {
  const p = createItemBody.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  return json({ id: await createItem(ctx, p.data, req) }, 201);
});
