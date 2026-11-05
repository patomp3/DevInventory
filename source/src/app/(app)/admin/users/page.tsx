import { notFound } from "next/navigation";
import { listUsersAndInvites } from "@/lib/admin-users";
import { getSessionUser } from "@/lib/auth/session";
import { UsersClient } from "./UsersClient";

export default async function AdminUsersPage() {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") notFound();
  const data = await listUsersAndInvites(me.workspaceId);
  return (
    <UsersClient
      meId={me.id}
      users={data.users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
      invites={data.invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }))}
    />
  );
}
