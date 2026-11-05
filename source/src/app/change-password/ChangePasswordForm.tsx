"use client";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { PasswordRules } from "@/components/PasswordRules";
import { checkPassword } from "@/lib/auth/password-policy";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = current && checkPassword(next).ok && next === confirm;
  const msg: Record<string, string> = {
    wrong_current_password: "รหัสผ่านปัจจุบันไม่ถูกต้อง", same_password: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม", weak_password: "รหัสผ่านไม่ผ่านเงื่อนไข",
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/v1/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
    if (res.ok) { window.location.href = "/"; return; }
    const d = await res.json().catch(() => ({}));
    setErr(msg[d.error] ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <Field label="รหัสผ่านปัจจุบัน (หรือรหัสชั่วคราว)" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field label="รหัสผ่านใหม่" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
      <PasswordRules password={next} />
      <Field label="ยืนยันรหัสผ่านใหม่" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
        hint={confirm && next !== confirm ? "รหัสผ่านไม่ตรงกัน" : undefined} />
      <Button type="submit" className="w-full" disabled={busy || !valid}>บันทึกรหัสผ่านใหม่</Button>
    </form>
  );
}
