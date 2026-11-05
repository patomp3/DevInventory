import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { createCollection } from "@/lib/collections";
import { AppError } from "@/lib/errors";

const body = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).nullish(),
  icon: z.string().max(8).nullish(),
  parentId: z.string().uuid().nullish(),
  visibility: z.enum(["inherit", "private", "workspace_view", "workspace_edit"]).optional(),
});

export const POST = userRoute(async ({ req, ctx }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  return json({ id: await createCollection(ctx, p.data, req) }, 201);
});
