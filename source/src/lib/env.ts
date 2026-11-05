import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  FILES_DIR: z.string().default("/data/files"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(10).optional(),
});

let cached: z.infer<typeof schema> | undefined;

/** อ่านและตรวจ environment ตอนใช้งานครั้งแรก (ไม่ตรวจตอน build) */
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
