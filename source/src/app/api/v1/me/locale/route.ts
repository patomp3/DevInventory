import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, originOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/locales";

const body = z.object({ locale: z.enum(LOCALES) });

/**
 * PUT /api/v1/me/locale — เลือกภาษา
 * - ตั้ง cookie เสมอ (ให้หน้า login/คำเชิญที่ยังไม่มี session ใช้ภาษาที่เลือก)
 * - ถ้า login อยู่ จะบันทึกลงบัญชีของ "ตัวเอง" ด้วย (ไม่รับ user id จาก client) — ผู้ใช้ที่ยังต้องเปลี่ยนรหัสผ่านก็ตั้งได้
 * ไม่คืนข้อมูลใด ๆ ของระบบ จึงไม่ต้องมี session (ยังตรวจ Origin กัน CSRF)
 */
export async function PUT(req: Request) {
  if (!originOk(req)) return fail(403, "bad_origin");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(422, "validation");
  const { locale } = parsed.data;
  const user = await getSessionUser();
  if (user) await db().update(users).set({ locale }).where(eq(users.id, user.id));
  const secure = new URL(env().APP_BASE_URL).protocol === "https:";
  const res = Response.json({ locale });
  res.headers.append("Set-Cookie", `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`);
  return res;
}
