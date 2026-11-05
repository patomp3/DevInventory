import { hashPassword } from "better-auth/crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { fail, json, originOk } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { checkPassword } from "@/lib/auth/password-policy";
import { db } from "@/lib/db";
import { account, invites, users } from "@/lib/db/schema";
import { hashToken } from "@/lib/invites";

const body = z.object({
  token: z.string().min(20).max(200),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().max(128),
});

/** ทางเดียวที่สร้างบัญชีได้ (D21): อีเมลมาจากคำเชิญ แก้ไม่ได้ */
export async function POST(req: Request) {
  if (!originOk(req)) return fail(403, "bad_origin");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_input");
  const { token, displayName, password } = parsed.data;
  if (!checkPassword(password).ok) return fail(400, "weak_password");

  const passwordHash = await hashPassword(password);
  const result = await db().transaction(async (tx) => {
    const [inv] = await tx
      .select().from(invites)
      .where(and(eq(invites.tokenHash, hashToken(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
      .for("update").limit(1);
    if (!inv) return null;
    const [exists] = await tx.select({ id: users.id }).from(users).where(eq(users.email, inv.email)).limit(1);
    if (exists) return null;

    const userId = uuidv7();
    await tx.insert(users).values({ id: userId, workspaceId: inv.workspaceId, email: inv.email, displayName, role: inv.role });
    await tx.insert(account).values({ userId, accountId: userId, providerId: "credential", password: passwordHash });
    await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, inv.id));
    await audit(tx, req, { workspaceId: inv.workspaceId, actorId: userId, action: "invite.accepted", targetType: "user", targetId: userId, after: { email: inv.email, role: inv.role } });
    return { email: inv.email };
  });
  if (!result) return fail(400, "invalid_invite"); // ไม่แยกสาเหตุ

  await getAuth().api.signInEmail({ body: { email: result.email, password }, headers: req.headers });
  return json({ ok: true });
}
