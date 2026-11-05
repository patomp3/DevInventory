import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { clientIp, fail, json, originOk } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loginAttempts, users } from "@/lib/db/schema";

const MAX_ATTEMPTS = 5;
const WINDOW_MIN = 15;
const body = z.object({ email: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) });

export async function POST(req: Request) {
  if (!originOk(req)) return fail(403, "bad_origin");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_input");
  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(req);
  const since = sql`now() - interval '${sql.raw(String(WINDOW_MIN))} minutes'`;
  const recent = and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip), gt(loginAttempts.attemptedAt, since));

  const [{ n } = { n: 0 }] = await db().select({ n: sql<number>`count(*)::int` }).from(loginAttempts).where(recent);
  if (n >= MAX_ATTEMPTS) return fail(429, "locked", { retryAfterMinutes: WINDOW_MIN });

  const [u] = await db().select().from(users).where(eq(users.email, email)).limit(1);
  let ok = false;
  if (u && u.status === "active") {
    try {
      await getAuth().api.signInEmail({ body: { email, password: parsed.data.password }, headers: req.headers });
      ok = true;
    } catch {
      ok = false;
    }
  }

  if (!ok) {
    await db().insert(loginAttempts).values({ email, ip });
    const remaining = Math.max(0, MAX_ATTEMPTS - (n + 1));
    // ข้อความเดียวทุกกรณี ไม่บอกว่าผิดช่องไหนหรือมีอีเมลนี้หรือไม่
    return fail(401, "invalid_credentials", { remaining, locked: remaining === 0 });
  }

  await db().delete(loginAttempts).where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u!.id));
  await audit(db(), req, { workspaceId: u!.workspaceId, actorId: u!.id, action: "auth.login", targetType: "user", targetId: u!.id, after: { method: "password" } });
  return json({ ok: true, mustChangePassword: u!.mustChangePassword });
}
