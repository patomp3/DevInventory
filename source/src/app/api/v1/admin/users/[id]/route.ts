import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { activeAdminCount } from "@/lib/admin-users";
import { fail, json, requireAdmin } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { session, users } from "@/lib/db/schema";

const body = z.object({ status: z.enum(["active", "disabled"]).optional(), role: z.enum(["admin", "member"]).optional() })
  .refine((b) => b.status || b.role);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin(req);
  if (me instanceof Response) return me;
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_input");
  const [target] = await db().select().from(users).where(and(eq(users.id, id), eq(users.workspaceId, me.workspaceId))).limit(1);
  if (!target) return fail(404, "not_found");

  const { status, role } = parsed.data;
  const losesAdmin = (status === "disabled" || role === "member") && target.role === "admin" && target.status === "active";
  if (losesAdmin && (target.id === me.id || (await activeAdminCount(me.workspaceId)) <= 1)) {
    return fail(409, target.id === me.id ? "cannot_demote_self" : "last_admin");
  }

  await db().transaction(async (tx) => {
    await tx.update(users).set({ ...(status && { status }), ...(role && { role }), updatedAt: new Date() }).where(eq(users.id, id));
    if (status === "disabled") await tx.delete(session).where(eq(session.userId, id)); // session หลุดทันที
    if (status && status !== target.status) {
      await audit(tx, req, { workspaceId: me.workspaceId, actorId: me.id, action: status === "disabled" ? "user.disabled" : "user.enabled", targetType: "user", targetId: id });
    }
    if (role && role !== target.role) {
      await audit(tx, req, { workspaceId: me.workspaceId, actorId: me.id, action: "user.role_changed", targetType: "user", targetId: id, before: { role: target.role }, after: { role } });
    }
  });
  return json({ ok: true });
}
