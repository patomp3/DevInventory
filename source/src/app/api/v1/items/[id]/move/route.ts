import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { moveItem } from "@/lib/items";

const body = z.object({ collectionId: z.string().uuid().nullable() });

export const PATCH = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  await moveItem(ctx, params.id, p.data.collectionId, req);
  return json({ ok: true });
});
