// สร้าง Workspace + Super Admin คนแรกจาก env (บัญชีเดียวที่เกิดได้โดยไม่ผ่านคำเชิญ) — รันซ้ำได้ ไม่ทำอะไรถ้ามีผู้ใช้แล้ว
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { uuidv7 } from "uuidv7";

const { DATABASE_URL, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!INITIAL_ADMIN_EMAIL || !INITIAL_ADMIN_PASSWORD) {
  console.log("INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD not set — skip seeding");
  process.exit(0);
}
if (INITIAL_ADMIN_PASSWORD.length < 10) throw new Error("INITIAL_ADMIN_PASSWORD must be at least 10 characters");

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM users");
  if (rows[0].n > 0) {
    console.log("users already exist — skip seeding");
  } else {
    const wsId = uuidv7();
    const userId = uuidv7();
    await client.query("BEGIN");
    await client.query("INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)", [wsId, process.env.WORKSPACE_NAME ?? "Dev Team", "default"]);
    await client.query(
      "INSERT INTO users (id, workspace_id, email, display_name, role, is_super_admin, must_change_password) VALUES ($1,$2,lower($3),$4,'admin',true,true)",
      [userId, wsId, INITIAL_ADMIN_EMAIL, "Admin"],
    );
    await client.query(
      "INSERT INTO account (id, user_id, account_id, provider_id, password) VALUES ($1,$2::uuid,$2::text,'credential',$3)",
      [uuidv7(), userId, await hashPassword(INITIAL_ADMIN_PASSWORD)],
    );
    await client.query("INSERT INTO audit_logs (workspace_id, actor_id, action, target_type, target_id) VALUES ($1,$2,'user.seeded','user',$2)", [wsId, userId]);
    await client.query("COMMIT");
    console.log(`seeded workspace and super admin ${INITIAL_ADMIN_EMAIL} (must change password on first login)`);
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await client.end();
}
