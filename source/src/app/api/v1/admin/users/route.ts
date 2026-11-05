import { fail, json, requireAdmin } from "@/lib/api";
import { listUsersAndInvites } from "@/lib/admin-users";

export async function GET(req: Request) {
  const me = await requireAdmin(req);
  if (me instanceof Response) return me;
  return json(await listUsersAndInvites(me.workspaceId));
}
export const POST = () => fail(405, "no_direct_user_creation"); // สร้างบัญชีได้ผ่านคำเชิญเท่านั้น (D21)
