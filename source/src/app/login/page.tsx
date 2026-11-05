import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const u = await getSessionUser();
  if (u) redirect(u.mustChangePassword ? "/change-password" : "/");
  return (
    <AuthCard title="เข้าสู่ระบบ" subtitle="Dev Inventory">
      <LoginForm />
      <div className="space-y-1 text-xs text-muted">
        <p>ลืมรหัสผ่าน? ให้ผู้ดูแลระบบของทีมรีเซ็ตให้</p>
        <p>ยังไม่มีบัญชี? ขอลิงก์เชิญจากผู้ดูแลระบบ</p>
      </div>
    </AuthCard>
  );
}
