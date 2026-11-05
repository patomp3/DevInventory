import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, json, requireAdmin } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { hashToken, INVITE_TTL_MS, newToken } from "@/lib/invites";

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(["member", "admin"]).default("member") });

export async function POST(req: Request) {
  const me = await requireAdmin(req);
  if (me instanceof Response) return me;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_email");
  const { email, role } = parsed.data;

  const [existing] = await db().select({ id: users.id, status: users.status }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return fail(409, "user_exists", { disabled: existing.status === "disabled" });

  const token = newToken();
  try {
    await db().transaction(async (tx) => {
      const [inv] = await tx.insert(invites).values({
        workspaceId: me.workspaceId, email, role, tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS), createdBy: me.id,
      }).returning({ id: invites.id });
      await audit(tx, req, { workspaceId: me.workspaceId, actorId: me.id, action: "invite.created", targetType: "user", targetId: inv!.id, after: { email, role } });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505") {
      return fail(409, "invite_pending"); // ชน unique index invites_pending_email
    }
    throw e;
  }
  return json({ email, role, link: `${env().APP_BASE_URL}/invite/${token}`, expiresInDays: 7 }, 201);
}
