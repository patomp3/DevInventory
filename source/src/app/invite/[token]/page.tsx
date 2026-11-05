import { AuthCard } from "@/components/AuthCard";
import { lookupInvite } from "@/lib/invites";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await lookupInvite(token);
  if (!inv) {
    return (
      <AuthCard title="ลิงก์เชิญไม่ถูกต้อง">
        <p className="text-sm text-muted">ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ ติดต่อผู้ดูแลระบบ</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="ตั้งรหัสผ่าน" subtitle={`คุณถูกเชิญเข้า ${inv.workspaceName} ในบทบาท ${inv.role === "admin" ? "Admin" : "Member"} · ลิงก์นี้ใช้ได้ครั้งเดียว`}>
      <SetPasswordForm token={token} email={inv.email} />
    </AuthCard>
  );
}
