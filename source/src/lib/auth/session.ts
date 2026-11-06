import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { Ctx, Role } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  workspaceId: string;
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
};

/** อ่าน session แล้วตรวจสถานะผู้ใช้จาก DB ทุกครั้ง (ผู้ใช้ที่ถูกปิดบัญชีใช้งานต่อไม่ได้ทันที) */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const h = await headers(); // เรียกก่อน getAuth(): ให้ Next รู้ว่าเป็น dynamic ก่อนที่จะอ่าน env (ตอน build ไม่มี env)
  const s = await getAuth().api.getSession({ headers: h });
  if (!s) return null;
  const [u] = await db().select().from(users).where(eq(users.id, s.user.id)).limit(1);
  if (!u || u.status !== "active" || !u.workspaceId) return null;
  return {
    id: u.id, email: u.email, displayName: u.displayName, role: u.role, workspaceId: u.workspaceId,
    mustChangePassword: u.mustChangePassword, isSuperAdmin: u.isSuperAdmin,
  };
});

export function toCtx(u: SessionUser): Ctx {
  return { userId: u.id, workspaceId: u.workspaceId, role: u.role };
}

import { notFound as nextNotFound, redirect } from "next/navigation";
import { AppError } from "@/lib/errors";

/** สำหรับ server component: ต้อง login (layout ตรวจแล้ว แต่ page ต้องใช้ ctx เอง) */
export async function requireCtx() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return { user: u, ctx: toCtx(u) };
}

/** AppError 404/403 → หน้า 404 ของ Next (ไม่แยกว่าไม่มีหรือไม่มีสิทธิ์) */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) nextNotFound();
    throw e;
  }
}
