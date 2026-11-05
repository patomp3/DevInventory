import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { fail, json, originOk } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { checkPassword } from "@/lib/auth/password-policy";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { account, session, users } from "@/lib/db/schema";
import { headers } from "next/headers";

const body = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().max(128) });

export async function POST(req: Request) {
  if (!originOk(req)) return fail(403, "bad_origin");
  const u = await getSessionUser();
  if (!u) return fail(401, "unauthenticated");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_input");
  const { currentPassword, newPassword } = parsed.data;
  if (!checkPassword(newPassword).ok) return fail(400, "weak_password");
  if (newPassword === currentPassword) return fail(400, "same_password");

  const [acc] = await db().select().from(account).where(and(eq(account.userId, u.id), eq(account.providerId, "credential"))).limit(1);
  if (!acc?.password || !(await verifyPassword({ hash: acc.password, password: currentPassword }))) {
    return fail(400, "wrong_current_password");
  }
  const current = await getAuth().api.getSession({ headers: await headers() });
  await db().transaction(async (tx) => {
    await tx.update(account).set({ password: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(account.id, acc.id));
    await tx.update(users).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, u.id));
    // ออกจากระบบทุกอุปกรณ์อื่น
    if (current) await tx.delete(session).where(and(eq(session.userId, u.id), ne(session.id, current.session.id)));
    await audit(tx, req, { workspaceId: u.workspaceId, actorId: u.id, action: "user.password_changed", targetType: "user", targetId: u.id });
  });
  return json({ ok: true });
}
