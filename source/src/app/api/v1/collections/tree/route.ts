import { json, userRoute } from "@/lib/api";
import { listTree } from "@/lib/collections";

export const GET = userRoute(async ({ ctx }) => json({ tree: await listTree(ctx) }));
