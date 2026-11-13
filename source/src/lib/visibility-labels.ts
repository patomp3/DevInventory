import type { Effective, Setting } from "@/lib/permissions";
import type { MsgKey } from "@/lib/i18n/messages";

/** ป้ายสิทธิ์เป็น key ของข้อความ — แปลที่จุดแสดงผลด้วย t(VIS_LABEL[x]) */
export const VIS_LABEL: Record<Setting, MsgKey> = {
  private: "vis.private", workspace_view: "vis.workspace_view", workspace_edit: "vis.workspace_edit", inherit: "vis.inherit",
};
export const VIS_ICON: Record<Setting, string> = { private: "🔒", workspace_view: "👥", workspace_edit: "✏️", inherit: "↳" };
export const VIS_HELP: Record<Effective, MsgKey> = {
  private: "vis.help.private",
  workspace_view: "vis.help.workspace_view",
  workspace_edit: "vis.help.workspace_edit",
};
