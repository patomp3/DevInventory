import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, originOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { THEME_COOKIE, THEMES } from "@/lib/theme";

const body = z.object({ theme: z.enum(THEMES) });

/** PUT /api/v1/me/theme — เลือกธีม (light/dark): ตั้ง cookie เสมอ + บันทึกลงบัญชีของ "ตัวเอง" ถ้า login อยู่ (เหมือน /me/locale) */
export async function PUT(req: Request) {
  if (!originOk(req)) return fail(403, "bad_origin");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(422, "validation");
  const { theme } = parsed.data;
  const user = await getSessionUser();
  if (user) await db().update(users).set({ theme }).where(eq(users.id, user.id));
  const secure = new URL(env().APP_BASE_URL).protocol === "https:";
  const res = Response.json({ theme });
  res.headers.append("Set-Cookie", `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`);
  return res;
}
