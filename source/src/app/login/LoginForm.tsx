"use client";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Alert, Button, Field } from "@/components/ui";

export function LoginForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ remaining?: number; locked?: boolean; server?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { window.location.href = data.mustChangePassword ? "/change-password" : "/"; return; }
    if (res.status === 401 || res.status === 429) setErr(res.status === 429 ? { locked: true } : { remaining: data.remaining, locked: data.locked });
    else setErr({ server: true }); // 4xx/5xx อื่น ๆ = ปัญหาฝั่งเซิร์ฟเวอร์/การตั้งค่า ไม่ใช่รหัสผิด
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {err && (
        <Alert>
          {err.server ? (
            <>{t("login.serverError")}</>
          ) : err.locked ? (
            <>{t("login.locked")}</>
          ) : (
            <>{t("login.invalid")}{err.remaining != null && <><br />{t("login.remaining", { n: err.remaining })}</>}</>
          )}
        </Alert>
      )}
      <Field label={t("login.email")} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label={t("login.password")} type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
        right={<button type="button" onClick={() => setShow(!show)} className="rounded px-2 text-xs text-muted hover:text-text" aria-pressed={show}>{show ? t("common.hide") : t("common.show")}</button>} />
      <Button type="submit" className="w-full" disabled={busy || !email || !password}>{t("login.submit")}</Button>
    </form>
  );
}
