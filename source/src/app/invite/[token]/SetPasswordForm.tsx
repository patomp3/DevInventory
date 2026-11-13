"use client";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Alert, Button, Field } from "@/components/ui";
import { PasswordRules } from "@/components/PasswordRules";
import { checkPassword } from "@/lib/auth/password-policy";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const t = useT();
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
    setErr(d.error === "weak_password" ? t("auth.weakPassword") : t("auth.invalidInvite"));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <Field label={t("auth.displayName")} autoComplete="name" required value={displayName} onChange={(e) => setName(e.target.value)} />
      <Field label={t("login.email")} value={email} readOnly hint={t("auth.emailFromInvite")} />
      <Field label={t("auth.newPw")} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <PasswordRules password={password} />
      <Field label={t("auth.confirmPw")} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
        hint={confirm && password !== confirm ? t("auth.mismatch") : undefined} />
      <Button type="submit" className="w-full" disabled={busy || !valid}>{t("auth.createAccount")}</Button>
    </form>
  );
}
