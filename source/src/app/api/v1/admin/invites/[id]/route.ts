import { and, eq, isNull } from "drizzle-orm";
import { fail, json, requireAdmin } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { isUuid } from "@/lib/uuid";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin(req);
  if (me instanceof Response) return me;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, "not_found");
  const del = await db().transaction(async (tx) => {
    const rows = await tx.delete(invites)
      .where(and(eq(invites.id, id), eq(invites.workspaceId, me.workspaceId), isNull(invites.usedAt)))
      .returning({ email: invites.email });
    if (rows[0]) await audit(tx, req, { workspaceId: me.workspaceId, actorId: me.id, action: "invite.revoked", targetType: "user", targetId: id, before: { email: rows[0].email } });
    return rows[0];
  });
  return del ? json({ ok: true }) : fail(404, "not_found");
}
