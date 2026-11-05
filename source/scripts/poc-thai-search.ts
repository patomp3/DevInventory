// Thai search PoC (design.md §8.8, §17 สัปดาห์ 1)
// ใช้: DATABASE_URL=... npm run db:migrate && DATABASE_URL=... npm run poc:search
// สร้างรายการภาษาไทย 10,000 แถว แล้ววัดว่า pg_trgm + LIKE '%term%' ใช้ index และเร็วพอหรือไม่
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildSearchText, likePattern } from "../src/lib/search/normalize";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const ROWS = Number(process.env.POC_ROWS ?? 10_000);

const words = [
  "ติดตั้ง", "ระบบ", "ฐานข้อมูล", "สำรองข้อมูล", "เซิร์ฟเวอร์", "คู่มือ", "ตั้งค่า", "ผู้ใช้งาน",
  "รหัสผ่าน", "ปรับปรุง", "ประสิทธิภาพ", "ทดสอบ", "นำเข้า", "ส่งออก", "แก้ไขปัญหา", "เครือข่าย",
  "ใบรับรอง", "ล็อกอิน", "ตรวจสอบสิทธิ์", "ไฟล์แนบ", "docker", "compose", "nginx", "postgres", "deploy",
];
const queries = ["ติดตั้ง", "ระบบ", "ข้อมูล", "ผู้ใช้", "สิทธิ์", "รหัส", "ไฟล์", "ตั้ง", "ล็อก", "ทดสอบ", "ปรับ", "ใบรับ"];
const rnd = (n: number) => Math.floor(Math.random() * n);
// ข้อความไทยต่อกันไม่มีช่องว่าง (เหมือนข้อความจริง) สลับกับคำอังกฤษคั่นด้วยช่องว่าง
const sentence = (n: number) =>
  Array.from({ length: n }, () => words[rnd(words.length)]!).join(rnd(3) === 0 ? " " : "");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const info = (await client.query("SELECT datcollate, datctype, datlocprovider FROM pg_database WHERE datname = current_database()")).rows[0];
  console.log("database locale:", info, "(ต้องเป็น provider 'i' = ICU และ th-TH)");

  const wsId = randomUUID();
  const userId = randomUUID();
  await client.query("BEGIN");
  await client.query("INSERT INTO workspaces (id, name, slug) VALUES ($1,'poc',$2)", [wsId, `poc-${wsId}`]);
  await client.query("INSERT INTO users (id, workspace_id, email, display_name) VALUES ($1,$2,$3,'poc')", [userId, wsId, `poc-${userId}@example.com`]);
  for (let i = 0; i < ROWS; i++) {
    const title = sentence(3 + rnd(3));
    const st = buildSearchText({ title, summary: sentence(6), body: sentence(40 + rnd(60)), tagNames: [words[rnd(words.length)]!] });
    await client.query(
      "INSERT INTO items (id, workspace_id, type, title, owner_id, visibility, effective_visibility, search_text) VALUES ($1,$2,'note',$3,$4,'workspace_view','workspace_view',$5)",
      [randomUUID(), wsId, title, userId, st],
    );
  }
  await client.query("COMMIT");
  await client.query("ANALYZE items");
  console.log(`inserted ${ROWS} rows\n`);

  console.log("term\tlen\trows\tms\tplan");
  for (const term of queries) {
    const sql = "SELECT count(*) FROM items WHERE workspace_id = $1 AND deleted_at IS NULL AND search_text LIKE $2";
    const plan = (await client.query("EXPLAIN (ANALYZE, FORMAT TEXT) " + sql, [wsId, likePattern(term)])).rows.map((r) => r["QUERY PLAN"] as string);
    const ms = /Execution Time: ([\d.]+) ms/.exec(plan.join("\n"))?.[1];
    const usesIndex = plan.some((l) => l.includes("items_search_trgm")) ? "trgm-index" : "SEQ SCAN";
    const rows = (await client.query(sql, [wsId, likePattern(term)])).rows[0].count;
    console.log(`${term}\t${[...term].length}\t${rows}\t${ms}\t${usesIndex}`);
  }
  console.log("\nเกณฑ์ผ่าน: ทุกคำตอบสนอง < 300 ms; คำ 2-6 ตัวอักษรควรใช้ trgm-index หรือเร็วพอแม้ seq scan");
  console.log("ถ้าไม่ผ่าน ให้ใช้ fallback ใน design.md §8.8 (pg_bigm / แยกคำด้วย ICU word break ฝั่ง app)");

  await client.query("DELETE FROM items WHERE workspace_id = $1", [wsId]);
  await client.query("DELETE FROM users WHERE id = $1", [userId]);
  await client.query("DELETE FROM workspaces WHERE id = $1", [wsId]);
} finally {
  await client.end();
}
