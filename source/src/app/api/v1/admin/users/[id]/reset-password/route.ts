import { hashPassword } from "better-auth/crypto";
import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { fail, json, requireAdmin } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { account, session, users } from "@/lib/db/schema";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // ไม่มีตัวที่สับสน (0/O, 1/l/I)
const tempPassword = () => Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin(req);
  if (me instanceof Response) return me;
  const { id } = await params;
  const [target] = await db().select().from(users).where(and(eq(users.id, id), eq(users.workspaceId, me.workspaceId))).limit(1);
  if (!target) return fail(404, "not_found");
  if (target.status !== "active") return fail(409, "user_disabled");

  const pw = tempPassword();
  const hash = await hashPassword(pw);
  await db().transaction(async (tx) => {
    await tx.update(account).set({ password: hash, updatedAt: new Date() }).where(and(eq(account.userId, id), eq(account.providerId, "credential")));
    await tx.update(users).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await audit(tx, req, { workspaceId: me.workspaceId, actorId: me.id, action: "user.password_reset", targetType: "user", targetId: id });
  });
  return json({ temporaryPassword: pw }); // แสดงครั้งเดียว ไม่เก็บในรูป plain text
}
