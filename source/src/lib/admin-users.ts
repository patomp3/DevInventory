import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";

export async function listUsersAndInvites(workspaceId: string) {
  const [us, inv] = await Promise.all([
    db().select({
      id: users.id, email: users.email, displayName: users.displayName, role: users.role,
      status: users.status, lastLoginAt: users.lastLoginAt,
    }).from(users).where(eq(users.workspaceId, workspaceId)).orderBy(asc(users.displayName)),
    db().select({ id: invites.id, email: invites.email, role: invites.role, expiresAt: invites.expiresAt })
      .from(invites).where(and(eq(invites.workspaceId, workspaceId), isNull(invites.usedAt), sql`${invites.expiresAt} > now()`))
      .orderBy(asc(invites.createdAt)),
  ]);
  return { users: us, invites: inv };
}

/** นับ Admin ที่ยัง active (กันปิด/ลดสิทธิ์ Admin คนสุดท้าย) */
export async function activeAdminCount(workspaceId: string) {
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(users)
    .where(and(eq(users.workspaceId, workspaceId), eq(users.role, "admin"), eq(users.status, "active")));
  return r?.n ?? 0;
}
