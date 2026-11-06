import { adminRoute, json, readJson } from "@/lib/api";
import { getSettings, SYSTEM_LIMITS, updateSettings } from "@/lib/workspace-settings";

/** GET /api/v1/admin/settings — ตั้งค่า Workspace + ข้อจำกัดระบบ (อ่านอย่างเดียว) */
export const GET = adminRoute(async ({ ctx }) => json({ settings: await getSettings(ctx), limits: SYSTEM_LIMITS }));

/** PATCH /api/v1/admin/settings — { name, defaultVisibility } บันทึก audit workspace.settings_changed */
export const PATCH = adminRoute(async ({ req, ctx }) => json({ settings: await updateSettings(ctx, await readJson(req), req) }));
