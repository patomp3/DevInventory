import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { deleteCollection, updateCollection } from "@/lib/collections";
import { AppError } from "@/lib/errors";

const body = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  icon: z.string().max(8).nullish(),
  parentId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["inherit", "private", "workspace_view", "workspace_edit"]).optional(),
});

export const PATCH = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  await updateCollection(ctx, params.id, p.data, req);
  return json({ ok: true });
});

export const DELETE = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  await deleteCollection(ctx, params.id, req);
  return json({ ok: true });
});
