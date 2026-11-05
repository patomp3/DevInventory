import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { createItem, listItems, type ListScope } from "@/lib/items";

const uuid = z.string().uuid();
const body = z.object({
  type: z.enum(["note", "snippet", "script", "file", "link"]),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(500).nullish(),
  body: z.string().max(200_000).nullish(),
  url: z.string().max(2000).nullish(),
  collectionId: uuid.nullish(),
  visibility: z.enum(["inherit", "private", "workspace_view", "workspace_edit"]).optional(),
});

export const GET = userRoute(async ({ req, ctx }) => {
  const q = new URL(req.url).searchParams;
  const scopeName = q.get("scope") ?? "recent";
  let scope: ListScope;
  if (q.get("collection")) {
    if (!uuid.safeParse(q.get("collection")).success) throw new AppError(422, "validation");
    scope = { kind: "collection", id: q.get("collection")! };
  } else if (scopeName === "inbox" || scopeName === "mine" || scopeName === "recent") scope = { kind: scopeName };
  else throw new AppError(422, "validation");
  const page = Math.max(0, Number(q.get("page") ?? 0) | 0);
  return json({ items: await listItems(ctx, scope, { limit: 50, offset: page * 50 }) });
});

export const POST = userRoute(async ({ req, ctx }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  return json({ id: await createItem(ctx, p.data, req) }, 201);
});
