"use client";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Alert, Button, Field } from "@/components/ui";
import { PasswordRules } from "@/components/PasswordRules";
import { checkPassword } from "@/lib/auth/password-policy";

export function ChangePasswordForm() {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = current && checkPassword(next).ok && next === confirm;
  const msg = {
    wrong_current_password: t("auth.wrongCurrent"), same_password: t("auth.samePassword"), weak_password: t("auth.weakPassword"),
  } as Record<string, string>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/v1/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
    if (res.ok) { window.location.href = "/"; return; }
    const d = await res.json().catch(() => ({}));
    setErr(msg[d.error] ?? t("auth.changeFailed"));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <Field label={t("auth.currentPw")} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field label={t("auth.newPw")} type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
      <PasswordRules password={next} />
      <Field label={t("auth.confirmNewPw")} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
        hint={confirm && next !== confirm ? t("auth.mismatch") : undefined} />
      <Button type="submit" className="w-full" disabled={busy || !valid}>{t("auth.saveNewPw")}</Button>
    </form>
  );
}
