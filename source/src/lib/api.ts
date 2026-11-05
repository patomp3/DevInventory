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
