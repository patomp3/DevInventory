// สร้าง workspace ทดสอบใหม่ + Admin 1 คน (ตรงใน DB ไม่ผ่านคำเชิญ) แล้วเขียนตัวแปรสำหรับ e2e-items.sh / e2e-auth.sh ลงไฟล์
// ใช้: npx tsx --env-file=.env scripts/e2e-workspace.ts <ไฟล์ปลายทาง>  →  source <ไฟล์> แล้วรัน e2e (ดู CLAUDE.md หัวข้อ ทดสอบ)
// ข้อมูลทดสอบอยู่ใน DB (audit_logs เป็น append-only จึงลบผู้ใช้ทดสอบไม่ได้) — ใช้กับ DB dev/CI เท่านั้น ห้ามรันกับ production
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { uuidv7 } from "uuidv7";

const out = process.argv[2];
if (!out) { console.error("ใช้: tsx scripts/e2e-workspace.ts <ไฟล์ปลายทาง>"); process.exit(1); }
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const tag = Date.now().toString(36);
const ws = uuidv7(), admin = uuidv7();
const pw = `E2e-${randomBytes(9).toString("base64url")}`;
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query("INSERT INTO workspaces (id,name,slug) VALUES ($1,$2,$3)", [ws, `e2e ${tag}`, `e2e-${tag}`]);
await c.query("INSERT INTO users (id,workspace_id,email,display_name,role) VALUES ($1,$2,$3,'E2E Admin','admin')", [admin, ws, `e2e-admin-${tag}@example.test`]);
await c.query("INSERT INTO account (id,user_id,account_id,provider_id,password) VALUES ($1,$2::uuid,$2::text,'credential',$3)", [uuidv7(), admin, await hashPassword(pw)]);
await c.end();
writeFileSync(out, `ADMIN_EMAIL=e2e-admin-${tag}@example.test\nMEMBER_EMAIL=e2e-member-${tag}@example.test\nINVITE_EMAIL=e2e-invite-${tag}@example.test\nADMIN_PW=${pw}\n`);
console.log(`created workspace e2e-${tag}`);
