import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, workspaces } from "@/lib/db/schema";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

/** คำเชิญที่ยังใช้ได้ (ไม่หมดอายุ ไม่ถูกใช้) — หน้าที่ใช้ต้องไม่แยกสาเหตุที่ใช้ไม่ได้ */
export async function lookupInvite(token: string) {
  const [row] = await db()
    .select({ id: invites.id, email: invites.email, role: invites.role, workspaceName: workspaces.name })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    .where(and(eq(invites.tokenHash, hashToken(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}
