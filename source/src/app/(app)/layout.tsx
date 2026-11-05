import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionUser, toCtx } from "@/lib/auth/session";
import { listTree } from "@/lib/collections";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/change-password");
  const tree = await listTree(toCtx(u));
  return <AppShell tree={tree} user={{ displayName: u.displayName, email: u.email, role: u.role }}>{children}</AppShell>;
}
