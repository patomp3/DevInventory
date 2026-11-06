import { TrashClient } from "./TrashClient";
import { requireCtx } from "@/lib/auth/session";
import { listTrash, TRASH_DAYS } from "@/lib/trash";

export default async function TrashPage() {
  const { ctx } = await requireCtx();
  const rows = await listTrash(ctx);
  return (
    <TrashClient days={TRASH_DAYS} isAdmin={ctx.role === "admin"}
      rows={rows.map((r) => ({ ...r, deletedAt: r.deletedAt.toISOString() }))} />
  );
}
