"use client";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ remaining?: number; locked?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { window.location.href = data.mustChangePassword ? "/change-password" : "/"; return; }
    setErr(res.status === 429 ? { locked: true } : { remaining: data.remaining, locked: data.locked });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {err && (
        <Alert>
          {err.locked ? (
            <>ลองผิดหลายครั้งเกินไป ถูกล็อกชั่วคราว 15 นาที</>
          ) : (
            <>อีเมลหรือรหัสผ่านไม่ถูกต้อง{err.remaining != null && <><br />ลองผิดได้อีก {err.remaining} ครั้ง ก่อนถูกล็อก 15 นาที</>}</>
          )}
        </Alert>
      )}
      <Field label="อีเมล" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="รหัสผ่าน" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
        right={<button type="button" onClick={() => setShow(!show)} className="rounded px-2 text-xs text-muted hover:text-text" aria-pressed={show}>{show ? "ซ่อน" : "แสดง"}</button>} />
      <Button type="submit" className="w-full" disabled={busy || !email || !password}>เข้าสู่ระบบ</Button>
    </form>
  );
}
