import { describe, expect, it } from "vitest";
import {
  canEdit, canManage, canTransfer, canView, resolveEffective,
  type Ctx, type Effective, type Resource,
} from "@/lib/permissions";

const WS = "ws-1";
const owner: Ctx = { userId: "u-owner", workspaceId: WS, role: "member" };
const member: Ctx = { userId: "u-member", workspaceId: WS, role: "member" };
const admin: Ctx = { userId: "u-admin", workspaceId: WS, role: "admin" };
const outsider: Ctx = { userId: "u-out", workspaceId: "ws-2", role: "admin" };

const item = (v: Effective, extra: Partial<Resource> = {}): Resource => ({
  workspaceId: WS, ownerId: owner.userId, effectiveVisibility: v, deletedAt: null, ...extra,
});

describe("matrix design.md §4.3", () => {
  // [visibility, ctx, view, edit, manage]
  const rows: [Effective, string, Ctx, boolean, boolean, boolean][] = [
    ["private", "owner", owner, true, true, true],
    ["private", "member", member, false, false, false],
    ["private", "admin", admin, false, false, false],
    ["workspace_view", "owner", owner, true, true, true],
    ["workspace_view", "member", member, true, false, false],
    ["workspace_view", "admin", admin, true, true, true],
    ["workspace_edit", "member", member, true, true, false],
    ["workspace_edit", "admin", admin, true, true, true],
  ];
  for (const [vis, who, ctx, v, e, m] of rows) {
    it(`${vis} / ${who}`, () => {
      expect(canView(ctx, item(vis))).toBe(v);
      expect(canEdit(ctx, item(vis))).toBe(e);
      expect(canManage(ctx, item(vis))).toBe(m);
    });
  }

  it("ข้าม workspace ไม่ได้แม้เป็น admin", () => {
    for (const vis of ["private", "workspace_view", "workspace_edit"] as const) {
      expect(canView(outsider, item(vis))).toBe(false);
      expect(canEdit(outsider, item(vis))).toBe(false);
    }
  });

  it("รายการในถังขยะไม่มีใครเห็น แม้เป็นเจ้าของ", () => {
    const trashed = item("workspace_edit", { deletedAt: new Date() });
    expect(canView(owner, trashed)).toBe(false);
    expect(canEdit(owner, trashed)).toBe(false);
    expect(canManage(admin, trashed)).toBe(false);
  });
});

describe("canTransfer (D6)", () => {
  const ok = { ownerDisabled: false, newOwnerId: "u-member", newOwnerActive: true };
  it("เฉพาะ Admin", () => {
    expect(canTransfer(member, item("workspace_view"), ok)).toBe(false);
    expect(canTransfer(admin, item("workspace_view"), ok)).toBe(true);
  });
  it("รายการส่วนตัวโอนได้เมื่อเจ้าของถูกปิดบัญชีเท่านั้น", () => {
    expect(canTransfer(admin, item("private"), ok)).toBe(false);
    expect(canTransfer(admin, item("private"), { ...ok, ownerDisabled: true })).toBe(true);
  });
  it("Admin โอนรายการส่วนตัวให้ตัวเองไม่ได้", () => {
    expect(canTransfer(admin, item("private"), { ownerDisabled: true, newOwnerId: admin.userId, newOwnerActive: true })).toBe(false);
  });
  it("ผู้รับต้อง active และไม่ใช่เจ้าของเดิม", () => {
    expect(canTransfer(admin, item("workspace_view"), { ...ok, newOwnerActive: false })).toBe(false);
    expect(canTransfer(admin, item("workspace_view"), { ...ok, newOwnerId: owner.userId })).toBe(false);
  });
});

describe("resolveEffective (§4.4)", () => {
  it("ค่าที่ตั้งเองชนะเสมอ", () => {
    expect(resolveEffective("private", "workspace_edit", "workspace_view")).toBe("private");
  });
  it("inherit ใช้ค่า Collection แม่", () => {
    expect(resolveEffective("inherit", "workspace_edit", "workspace_view")).toBe("workspace_edit");
  });
  it("inherit ที่ไม่มี Collection ใช้ default ของ Workspace", () => {
    expect(resolveEffective("inherit", null, "workspace_view")).toBe("workspace_view");
  });
});
