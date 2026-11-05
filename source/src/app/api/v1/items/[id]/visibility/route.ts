import { z } from "zod";
import { json, readJson, userRoute } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { setItemVisibility } from "@/lib/items";

const body = z.object({ visibility: z.enum(["inherit", "private", "workspace_view", "workspace_edit"]) });

export const PATCH = userRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new AppError(422, "validation");
  await setItemVisibility(ctx, params.id, p.data.visibility, req);
  return json({ ok: true });
});
