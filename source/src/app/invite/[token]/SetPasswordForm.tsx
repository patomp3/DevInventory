"use client";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { PasswordRules } from "@/components/PasswordRules";
import { checkPassword } from "@/lib/auth/password-policy";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [displayName, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const valid = displayName.trim() && checkPassword(password).ok && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/v1/auth/accept-invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, displayName, password }) });
    if (res.ok) { window.location.href = "/"; return; }
    const d = await res.json().catch(() => ({}));
    setErr(d.error === "weak_password" ? "รหัสผ่านไม่ผ่านเงื่อนไข" : "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ ติดต่อผู้ดูแลระบบ");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <Field label="ชื่อที่แสดง" autoComplete="name" required value={displayName} onChange={(e) => setName(e.target.value)} />
      <Field label="อีเมล" value={email} readOnly hint="อีเมลมาจากคำเชิญ แก้ไขไม่ได้" />
      <Field label="รหัสผ่านใหม่" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <PasswordRules password={password} />
      <Field label="ยืนยันรหัสผ่าน" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
        hint={confirm && password !== confirm ? "รหัสผ่านไม่ตรงกัน" : undefined} />
      <Button type="submit" className="w-full" disabled={busy || !valid}>สร้างบัญชี</Button>
    </form>
  );
}
