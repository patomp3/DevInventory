// Better Auth (design.md §5, §14, §19.7) — เปิดเฉพาะอีเมล+รหัสผ่าน ปิดสมัครเอง (D21)
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/lib/db";
import { account, session, users, verification } from "@/lib/db/schema";
import { env } from "@/lib/env";

function create() {
  const e = env();
  return betterAuth({
    appName: "Dev Inventory",
    baseURL: e.APP_BASE_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins:
      process.env.NODE_ENV === "production"
        ? [e.APP_BASE_URL]
        : [e.APP_BASE_URL, "http://localhost:*", "http://127.0.0.1:*"], // dev: พอร์ตอาจไม่ใช่ 3000
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { users, session, account, verification },
    }),
    user: {
      modelName: "users",
      fields: { name: "displayName" },
      additionalFields: {
        role: { type: "string", input: false },
        workspaceId: { type: "string", required: false, input: false },
        status: { type: "string", input: false },
        mustChangePassword: { type: "boolean", input: false },
        isSuperAdmin: { type: "boolean", input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // ไม่มีการสมัครเอง: บัญชีเกิดได้จากคำเชิญหรือ seed เท่านั้น
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 }, // หมดอายุ 7 วันถ้าไม่ใช้งาน
    advanced: {
      // cookie ต้อง Secure เมื่อเข้าผ่าน HTTPS (production) — ไม่ปล่อยให้ขึ้นกับค่าเริ่มต้นของไลบรารี (design §14)
      useSecureCookies: e.APP_BASE_URL.startsWith("https://"),
      database: { generateId: () => uuidv7() },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    databaseHooks: {
      session: {
        create: {
          // จุดเดียวที่สร้าง session: ผู้ใช้ที่ไม่ active สร้าง session ไม่ได้ (§19.4 ข้อ 6)
          before: async (s) => {
            const [u] = await db().select({ status: users.status }).from(users).where(eq(users.id, s.userId)).limit(1);
            if (!u || u.status !== "active") return false;
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

let _auth: ReturnType<typeof create> | undefined;
export function getAuth() {
  return (_auth ??= create());
}
