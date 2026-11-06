// การแสดง/ส่งออก audit log — pure (ไม่ import db) ใช้ร่วมกับหน้า Admin และ export CSV

export type AuditRow = {
  id: number; createdAt: Date; actorName: string | null; actorEmail: string | null; action: string;
  targetType: string; targetId: string | null; before: unknown; after: unknown; ip: string | null;
};

/** ชื่อ action ภาษาไทยสำหรับแสดง (ไม่รู้จัก = แสดง action ตรง ๆ) */
export const ACTION_LABEL: Record<string, string> = {
  "auth.login": "เข้าสู่ระบบ", "auth.login_failed": "เข้าสู่ระบบไม่สำเร็จ", "auth.logout": "ออกจากระบบ",
  "user.seeded": "สร้าง Admin คนแรก", "user.invited": "เชิญผู้ใช้", "invite.created": "สร้างคำเชิญ", "invite.accepted": "รับคำเชิญ", "invite.revoked": "ยกเลิกคำเชิญ",
  "user.disabled": "ปิดบัญชี", "user.enabled": "เปิดบัญชี", "user.role_changed": "เปลี่ยนบทบาท", "user.password_reset": "รีเซ็ตรหัสผ่าน", "user.password_changed": "เปลี่ยนรหัสผ่าน",
  "collection.created": "สร้าง Collection", "collection.renamed": "เปลี่ยนชื่อ Collection", "collection.moved": "ย้าย Collection", "collection.deleted": "ลบ Collection",
  "collection.visibility_changed": "เปลี่ยนสิทธิ์ Collection",
  "item.created": "สร้างรายการ", "item.updated": "แก้ไขรายการ", "item.moved": "ย้ายรายการ", "item.visibility_changed": "เปลี่ยนสิทธิ์รายการ",
  "item.owner_transferred": "โอนความเป็นเจ้าของ", "item.deleted": "ลบรายการ (ถังขยะ)", "item.restored": "กู้จากถังขยะ", "item.purged": "ลบถาวร",
  "item.version_restored": "กู้เวอร์ชัน", "attachment.uploaded": "อัปโหลดไฟล์แนบ", "attachment.deleted": "ลบไฟล์แนบ", "attachment.purged": "ลบไฟล์แนบถาวร",
  "workspace.settings_changed": "เปลี่ยนการตั้งค่า Workspace",
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;

/** สรุป before/after เป็นข้อความสั้นอ่านง่าย (ไม่มีเนื้อหารายการอยู่ใน audit อยู่แล้ว แต่ตัดความยาวกันตารางล้น) */
export function summarizeDetail(row: Pick<AuditRow, "before" | "after">, max = 160): string {
  const parts: string[] = [];
  for (const [label, v] of [["ก่อน", row.before], ["หลัง", row.after]] as const) {
    if (v === null || v === undefined) continue;
    const t = typeof v === "string" ? v : JSON.stringify(v);
    if (t && t !== "{}") parts.push(`${label}: ${t}`);
  }
  const s = parts.join(" · ");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * ค่าใน CSV: ครอบด้วย " และ escape "" · ค่าที่ขึ้นต้นด้วย = + - @ tab CR ถูกนำหน้าด้วย ' กัน CSV/formula injection ใน Excel
 * (เช่นชื่อรายการหรืออีเมลที่ผู้ใช้ตั้งเองเป็น =HYPERLINK(...))
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const HEADER = ["เวลา", "ผู้กระทำ", "อีเมลผู้กระทำ", "action", "ชนิดเป้าหมาย", "เป้าหมาย", "ก่อน", "หลัง", "IP"];

/** CSV (UTF-8 พร้อม BOM ให้ Excel อ่านภาษาไทยถูก) */
export function auditToCsv(rows: AuditRow[]): string {
  const j = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));
  const lines = [HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      r.createdAt.toISOString(), r.actorName, r.actorEmail, r.action, r.targetType, r.targetId, j(r.before), j(r.after), r.ip,
    ].map(csvCell).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** วัน YYYY-MM-DD ที่ถูกต้องเท่านั้น (กรองช่วงวันที่ในหน้า Audit) */
export const isIsoDay = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
