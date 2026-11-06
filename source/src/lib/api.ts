import { env } from "@/lib/env";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
export function fail(status: number, code: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: code, ...extra }, { status });
}

/** CSRF: request ที่แก้ข้อมูลต้องมี Origin ตรงกับแอป (design.md §14) */
export function originOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return o.origin === new URL(env().APP_BASE_URL).origin || o.host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** ต้อง login เป็น admin ของ workspace; workspace มาจาก session เท่านั้น */
export async function requireAdmin(req: Request): Promise<SessionUser | Response> {
  if (req.method !== "GET" && !originOk(req)) return fail(403, "bad_origin");
  const u = await getSessionUser();
  if (!u) return fail(401, "unauthenticated");
  if (u.role !== "admin") return fail(404, "not_found"); // ไม่เปิดเผยว่ามีหน้านี้
  return u;
}

import { AppError } from "@/lib/errors";
import { toCtx } from "@/lib/auth/session";
import type { Ctx } from "@/lib/permissions";

/** route สำหรับผู้ใช้ที่ login แล้ว: ตรวจ Origin (CSRF), session, และแปลง AppError เป็น HTTP response */
export function userRoute<P = Record<string, string>>(
  fn: (a: { req: Request; ctx: Ctx; user: SessionUser; params: P }) => Promise<Response>,
) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && !originOk(req)) return fail(403, "bad_origin");
      const user = await getSessionUser();
      if (!user) return fail(401, "unauthenticated");
      if (user.mustChangePassword) return fail(403, "must_change_password");
      return await fn({ req, ctx: toCtx(user), user, params: await params });
    } catch (e) {
      if (e instanceof AppError) return fail(e.status, e.code, e.extra);
      throw e;
    }
  };
}

/** route สำหรับ Admin ของ workspace: ตรวจ Origin + session + บทบาท (ไม่ใช่ Admin = 404 ไม่เปิดเผยว่ามีหน้านี้) และแปลง AppError เป็น HTTP */
export function adminRoute<P = Record<string, string>>(
  fn: (a: { req: Request; ctx: Ctx; user: SessionUser; params: P }) => Promise<Response>,
) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      const me = await requireAdmin(req);
      if (me instanceof Response) return me;
      if (me.mustChangePassword) return fail(403, "must_change_password");
      return await fn({ req, ctx: toCtx(me), user: me, params: await params });
    } catch (e) {
      if (e instanceof AppError) return fail(e.status, e.code, e.extra);
      throw e;
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => { throw new AppError(400, "invalid_json"); });
}
