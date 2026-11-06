// รีเซ็ตรหัสผ่านจาก CLI (ทางหนีไฟเมื่อ Admin ทุกคนเข้าไม่ได้ — docs/runbook.md)
// ใช้: npm run user:reset-password -- someone@example.com
// สร้างรหัสชั่วคราวแบบสุ่ม แสดงครั้งเดียว ตั้ง must_change_password, ออกจากระบบทุกอุปกรณ์, ปลดล็อก login, บันทึก audit user.password_reset
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) { console.error("ใช้: npm run user:reset-password -- <อีเมล>"); process.exit(1); }
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const temp = `Tmp-${randomBytes(9).toString("base64url")}`;
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query("BEGIN");
  const { rows } = await c.query("select id, workspace_id, status from users where email = $1", [email]);
  const u = rows[0];
  if (!u) { console.error(`ไม่พบผู้ใช้ ${email}`); await c.query("ROLLBACK"); process.exit(2); }
  const r = await c.query("update account set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'", [await hashPassword(temp), u.id]);
  if (r.rowCount === 0) { console.error("บัญชีนี้ไม่มีรหัสผ่าน (credential)"); await c.query("ROLLBACK"); process.exit(3); }
  await c.query("update users set must_change_password = true, updated_at = now() where id = $1", [u.id]);
  await c.query("delete from session where user_id = $1", [u.id]);
  await c.query("delete from login_attempts where email = $1", [email]);
  await c.query(
    "insert into audit_logs (workspace_id, actor_id, action, target_type, target_id, after) values ($1, null, 'user.password_reset', 'user', $2, $3)",
    [u.workspace_id, u.id, JSON.stringify({ via: "cli", status: u.status })],
  );
  await c.query("COMMIT");
  console.log(`รีเซ็ตรหัสผ่านของ ${email} แล้ว${u.status !== "active" ? ` (หมายเหตุ: บัญชีนี้สถานะ ${u.status} ยังเข้าสู่ระบบไม่ได้จนกว่าจะเปิดบัญชี)` : ""}`);
  console.log(`รหัสผ่านชั่วคราว (แสดงครั้งเดียว): ${temp}`);
  console.log("ผู้ใช้ต้องตั้งรหัสใหม่ตอนเข้าสู่ระบบครั้งแรก");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await c.end();
}
