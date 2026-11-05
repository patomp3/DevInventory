import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

let _db: ReturnType<typeof makeDb> | undefined;

function makeDb() {
  const pool = new pg.Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return drizzle(pool, { schema });
}

/** สร้าง connection pool ตอนเรียกครั้งแรก (ไม่เชื่อมตอน build) */
export function db() {
  return (_db ??= makeDb());
}

export { schema };
