import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/change-password");
  return <AppShell user={{ displayName: u.displayName, email: u.email, role: u.role }}>{children}</AppShell>;
}
