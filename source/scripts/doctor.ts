// ตรวจสภาพแวดล้อมบนเครื่อง: npm run doctor
import { verifyPassword } from "better-auth/crypto";
import pg from "pg";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string, fix?: string) => { console.log(`  ✗ ${m}`); if (fix) console.log(`      → ${fix}`); problems++; };
let problems = 0;
const env = process.env;

console.log("1) ไฟล์ .env");
if (!env.DATABASE_URL) bad("ไม่มี DATABASE_URL", "คัดลอก .env.example เป็น .env"); else ok(`DATABASE_URL → ${env.DATABASE_URL.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@")}`);
if (/@db[:/]/.test(env.DATABASE_URL ?? "")) bad("DATABASE_URL ใช้โฮสต์ 'db' (ใช้ได้เฉพาะใน Docker)", "เปลี่ยนเป็น localhost");
if ((env.BETTER_AUTH_SECRET ?? "").length < 32) bad("BETTER_AUTH_SECRET ไม่มีหรือสั้นกว่า 32 ตัวอักษร", "ตั้งค่าใน .env (openssl rand -base64 32)"); else ok("BETTER_AUTH_SECRET ตั้งแล้ว");
const base = env.APP_BASE_URL ?? "";
if (!base.startsWith("http://localhost")) bad(`APP_BASE_URL = ${base || "(ว่าง)"}`, "บนเครื่อง dev ควรเป็น http://localhost:3000 และเปิดเว็บด้วยที่อยู่นี้"); else ok(`APP_BASE_URL = ${base}`);
if (!env.INITIAL_ADMIN_EMAIL || !env.INITIAL_ADMIN_PASSWORD) bad("ไม่มี INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD"); else ok(`INITIAL_ADMIN_EMAIL = ${env.INITIAL_ADMIN_EMAIL}`);

console.log("2) ฐานข้อมูล");
if (env.DATABASE_URL) {
  const c = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 4000 });
  try {
    await c.connect();
    ok("เชื่อมต่อ Postgres ได้");
    const m = await c.query("SELECT name FROM _migrations ORDER BY name").catch(() => null);
    if (!m) bad("ยังไม่ได้ migrate", "npm run db:migrate");
    else if (m.rows.length < 2) bad(`migrate ไม่ครบ (${m.rows.length} ไฟล์)`, "npm run db:migrate");
    else ok(`migrate แล้ว ${m.rows.length} ไฟล์ (${m.rows.at(-1).name})`);

    console.log("3) บัญชี Admin");
    const u = await c.query("SELECT count(*)::int AS n FROM users").catch(() => null);
    if (!u) bad("ไม่มีตาราง users", "npm run db:migrate");
    else if (u.rows[0].n === 0) bad("ยังไม่มีผู้ใช้เลย", "npm run db:seed");
    else {
      ok(`มีผู้ใช้ ${u.rows[0].n} คน`);
      const email = (env.INITIAL_ADMIN_EMAIL ?? "").toLowerCase();
      const r = await c.query(
        "SELECT u.status, u.must_change_password, a.password FROM users u LEFT JOIN account a ON a.user_id = u.id AND a.provider_id = 'credential' WHERE u.email = $1",
        [email],
      );
      if (!r.rows[0]) bad(`ไม่พบผู้ใช้ ${email}`, "seed จะข้ามถ้ามีผู้ใช้อยู่แล้ว — ใช้อีเมลของผู้ใช้ที่มีจริง หรือล้างฐานข้อมูลแล้ว seed ใหม่");
      else {
        ok(`พบผู้ใช้ ${email} (status=${r.rows[0].status}${r.rows[0].must_change_password ? ", ต้องเปลี่ยนรหัสผ่านตอน login" : ""})`);
        if (r.rows[0].status !== "active") bad("บัญชีถูกปิดอยู่");
        if (!r.rows[0].password) bad("ไม่มีรหัสผ่านผูกกับบัญชี");
        else if (env.INITIAL_ADMIN_PASSWORD && (await verifyPassword({ hash: r.rows[0].password, password: env.INITIAL_ADMIN_PASSWORD }))) ok("INITIAL_ADMIN_PASSWORD ตรงกับรหัสผ่านในฐานข้อมูล");
        else console.log("  ! INITIAL_ADMIN_PASSWORD ไม่ตรงกับรหัสผ่านปัจจุบัน (ปกติถ้าเปลี่ยนรหัสไปแล้วตอน login ครั้งแรก)");
      }
    }
  } catch (e) {
    bad(`เชื่อมต่อ Postgres ไม่ได้: ${(e as Error).message}`, "docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db แล้วรอสักครู่ (ตรวจ POSTGRES_PASSWORD ใน .env ให้ตรงกับรหัสใน DATABASE_URL ด้วย)");
  } finally {
    await c.end().catch(() => {});
  }
}
console.log(problems ? `\nพบปัญหา ${problems} รายการ — แก้ตามลูกศรด้านบนแล้วรันใหม่` : "\nทุกอย่างปกติ");
process.exit(problems ? 1 : 0);
