// Permission engine — design.md §4 และ §7 เป็นจุดเดียวที่ตัดสินสิทธิ์ทั้งระบบ
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { items } from "@/lib/db/schema";

export type Role = "admin" | "member";
export type Effective = "private" | "workspace_view" | "workspace_edit";
export type Setting = Effective | "inherit";

export type Ctx = { userId: string; workspaceId: string; role: Role };
export type Resource = {
  workspaceId: string;
  ownerId: string;
  effectiveVisibility: Effective;
  deletedAt: Date | null;
};

export function canView(ctx: Ctx, r: Resource): boolean {
  if (r.workspaceId !== ctx.workspaceId || r.deletedAt) return false;
  if (r.ownerId === ctx.userId) return true;
  return r.effectiveVisibility !== "private"; // Admin ไม่ผ่านสำหรับ private
}

export function canEdit(ctx: Ctx, r: Resource): boolean {
  if (!canView(ctx, r)) return false;
  if (r.ownerId === ctx.userId) return true;
  if (ctx.role === "admin" && r.effectiveVisibility !== "private") return true;
  return r.effectiveVisibility === "workspace_edit";
}

/** ลบ, ย้าย, เปลี่ยนสิทธิ์ */
export function canManage(ctx: Ctx, r: Resource): boolean {
  if (!canView(ctx, r)) return false;
  return r.ownerId === ctx.userId || (ctx.role === "admin" && r.effectiveVisibility !== "private");
}

/**
 * โอนความเป็นเจ้าของ (§4.3, D6): Admin เท่านั้น
 * - รายการไม่ส่วนตัว: โอนได้
 * - รายการส่วนตัว: โอนได้เฉพาะเมื่อเจ้าของถูกปิดบัญชี และผู้รับต้องเป็นคนอื่นที่ active ไม่ใช่ Admin เอง
 */
export function canTransfer(
  ctx: Ctx,
  r: Resource,
  opts: { ownerDisabled: boolean; newOwnerId: string; newOwnerActive: boolean },
): boolean {
  if (ctx.role !== "admin" || r.workspaceId !== ctx.workspaceId || r.deletedAt) return false;
  if (!opts.newOwnerActive || opts.newOwnerId === r.ownerId) return false;
  if (r.effectiveVisibility !== "private") return true;
  return opts.ownerDisabled && opts.newOwnerId !== ctx.userId;
}

/** Admin เห็นรายการส่วนตัวในหน้า Admin ได้เฉพาะ metadata */
export function canViewMetadata(ctx: Ctx, r: Resource): boolean {
  return ctx.role === "admin" && r.workspaceId === ctx.workspaceId;
}

/**
 * ค่า effective_visibility (§4.4)
 * - ตั้งค่าเอง → ใช้ค่านั้น
 * - inherit → ใช้ค่าของ Collection แม่
 * - ไม่มี Collection (Inbox) ต้องตั้งค่าเอง; ถ้าเป็น inherit ให้ใช้ default ของ Workspace
 */
export function resolveEffective(
  setting: Setting,
  parentEffective: Effective | null,
  workspaceDefault: Effective,
): Effective {
  if (setting !== "inherit") return setting;
  return parentEffective ?? workspaceDefault;
}

/** SQL predicate ตัวเดียวของระบบ (§7.2) ใช้กับทุก query ที่คืนรายการ */
export function visibleItemsWhere(ctx: Ctx): SQL {
  return and(
    eq(items.workspaceId, ctx.workspaceId),
    isNull(items.deletedAt),
    or(
      eq(items.ownerId, ctx.userId),
      inArray(items.effectiveVisibility, ["workspace_view", "workspace_edit"]),
    ),
  )!;
}
