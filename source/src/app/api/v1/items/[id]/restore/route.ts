import { json, userRoute } from "@/lib/api";
import { restoreItem } from "@/lib/trash";

/** POST /api/v1/items/:id/restore — กู้จากถังขยะ (Collection เดิมถูกลบแล้วจะกลับ Inbox) */
export const POST = userRoute<{ id: string }>(async ({ req, ctx, params }) => json(await restoreItem(ctx, params.id, req)));
