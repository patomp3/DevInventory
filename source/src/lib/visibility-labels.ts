import type { Effective, Setting } from "@/lib/permissions";

export const VIS_LABEL: Record<Setting, string> = {
  private: "ส่วนตัว", workspace_view: "ทีมดูได้", workspace_edit: "ทีมแก้ไขได้", inherit: "ตาม Collection",
};
export const VIS_ICON: Record<Setting, string> = { private: "🔒", workspace_view: "👥", workspace_edit: "✏️", inherit: "↳" };
export const VIS_HELP: Record<Effective, string> = {
  private: "เฉพาะเจ้าของเท่านั้น (Admin ก็ไม่เห็นเนื้อหา)",
  workspace_view: "ทุกคนในทีมดูได้ เจ้าของ (และ Admin) แก้ได้",
  workspace_edit: "ทุกคนในทีมดูและแก้เนื้อหาได้",
};
export const TYPE_LABEL: Record<string, string> = { note: "Note", snippet: "Snippet", script: "Script", file: "File", link: "Link" };
