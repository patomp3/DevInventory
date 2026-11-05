"use client";
import { checkPassword } from "@/lib/auth/password-policy";

export function PasswordRules({ password }: { password: string }) {
  const c = checkPassword(password);
  const Row = ({ ok, text }: { ok: boolean; text: string }) => (
    <li className={ok ? "text-emerald-300" : "text-muted"}><span aria-hidden>{ok ? "✓" : "○"}</span> {text}</li>
  );
  return (
    <ul className="space-y-0.5 text-xs" aria-live="polite">
      <Row ok={c.lengthOk} text="อย่างน้อย 10 ตัวอักษร" />
      <Row ok={c.notCommon} text="ไม่ใช่รหัสผ่านที่พบบ่อย" />
    </ul>
  );
}
