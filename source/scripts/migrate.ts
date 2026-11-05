// รัน SQL migration ใน /drizzle ตามลำดับชื่อไฟล์ แต่ละไฟล์อยู่ใน transaction เดียว
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const dir = join(process.cwd(), "drizzle");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set((await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name as string));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    console.log(`applying ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}
