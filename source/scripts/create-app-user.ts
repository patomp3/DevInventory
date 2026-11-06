// เปิดใช้ role สิทธิ์ต่ำของแอป (design.md §14): ตั้งรหัสผ่านให้ role inventory_app (สร้างไว้แล้วใน migration 0004) และอนุญาตให้ล็อกอิน
// ใช้: APP_DB_PASSWORD='…≥16 ตัว…' npm run db:app-user   (รันด้วยเจ้าของฐานข้อมูล = DATABASE_URL เดิม) แล้วตั้ง APP_DATABASE_URL ใน .env ตามที่พิมพ์ออกมา
import pg from "pg";

const url = process.env.DATABASE_URL;
const pw = process.env.APP_DB_PASSWORD;
if (!url) throw new Error("DATABASE_URL is required");
if (!pw || pw.length < 16) { console.error("ตั้ง APP_DB_PASSWORD ยาวอย่างน้อย 16 ตัวอักษร (เช่น openssl rand -base64 24)"); process.exit(1); }

const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  const { rows: [r] } = await c.query("select current_database() as db, (select count(*) from pg_roles where rolname = 'inventory_app') as has_role");
  if (Number(r.has_role) === 0) { console.error("ไม่พบ role inventory_app — รัน npm run db:migrate ก่อน (migration 0004)"); process.exit(2); }
  await c.query(`ALTER ROLE inventory_app LOGIN PASSWORD ${c.escapeLiteral(pw)}`);
  await c.query(`GRANT CONNECT ON DATABASE ${c.escapeIdentifier(r.db)} TO inventory_app`);
  const u = new URL(url);
  console.log("เปิดใช้ role inventory_app แล้ว ใส่ใน .env (สำหรับ service app และ purge):");
  console.log(`APP_DATABASE_URL=postgres://inventory_app:<APP_DB_PASSWORD>@${u.host}${u.pathname}`);
} finally {
  await c.end();
}
