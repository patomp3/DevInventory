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
  const s = await getAuth().api.getSession({ headers: await headers() });
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
