// Admin › ตั้งค่า (design.md §13, §14): ชื่อ Workspace + ค่าเริ่มต้นของสิทธิ์ (D15) — เปลี่ยนแล้วบันทึก audit workspace.settings_changed
import { eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-meta";
import type { Ctx, Effective } from "@/lib/permissions";
import { TRASH_DAYS } from "@/lib/trash";

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  defaultVisibility: z.enum(["private", "workspace_view", "workspace_edit"]),
});
export type WorkspaceSettings = { name: string; defaultVisibility: Effective; language: "th" };

/** ข้อจำกัดของระบบ (อ่านอย่างเดียวในหน้าตั้งค่า) */
export const SYSTEM_LIMITS = { maxFileMb: MAX_ATTACHMENT_BYTES / 1024 / 1024, inviteDays: 7, trashDays: TRASH_DAYS };

export async function getSettings(ctx: Ctx): Promise<WorkspaceSettings> {
  if (ctx.role !== "admin") throw notFound();
  const [w] = await db().select({ name: workspaces.name, defaultVisibility: workspaces.defaultVisibility }).from(workspaces).where(eq(workspaces.id, ctx.workspaceId));
  if (!w) throw notFound();
  return { name: w.name, defaultVisibility: w.defaultVisibility, language: "th" };
}

export async function updateSettings(ctx: Ctx, input: unknown, req: Request | null): Promise<WorkspaceSettings> {
  if (ctx.role !== "admin") throw notFound();
  const p = settingsSchema.safeParse(input);
  if (!p.success) throw new AppError(422, "validation");
  await db().transaction(async (tx) => {
    const [before] = await tx.select({ name: workspaces.name, defaultVisibility: workspaces.defaultVisibility }).from(workspaces).where(eq(workspaces.id, ctx.workspaceId)).for("update");
    if (!before) throw notFound();
    if (before.name === p.data.name && before.defaultVisibility === p.data.defaultVisibility) return; // ไม่เปลี่ยน ไม่ต้องบันทึก
    await tx.update(workspaces).set({ name: p.data.name, defaultVisibility: p.data.defaultVisibility, updatedAt: new Date() }).where(eq(workspaces.id, ctx.workspaceId));
    await audit(tx, req, { workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "workspace.settings_changed", targetType: "workspace", targetId: ctx.workspaceId, before, after: p.data });
  });
  return getSettings(ctx);
}
