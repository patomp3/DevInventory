import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSessionUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return (
    <AuthCard title="เปลี่ยนรหัสผ่าน" subtitle={u.mustChangePassword ? "ต้องตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน" : u.email}>
      <ChangePasswordForm />
    </AuthCard>
  );
}
