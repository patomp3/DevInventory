"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { apiError } from "@/components/PermissionDialog";
import { Alert, Button, CopyBox, Dialog, Field } from "@/components/ui";
import { DATE_LOCALE } from "@/lib/i18n/locales";

type U = { id: string; email: string; displayName: string; role: "admin" | "member"; status: string; lastLoginAt: string | null };
type Inv = { id: string; email: string; role: "admin" | "member"; expiresAt: string };
type Modal =
  | { k: "invite" }
  | { k: "invite-result"; email: string; role: string; link: string }
  | { k: "confirm"; title: string; body: string; danger?: boolean; label: string; run: () => Promise<string | void> }
  | { k: "temp"; name: string; password: string };

const roleLabel = (r: string) => (r === "admin" ? "Admin" : "Member");

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function UsersClient({ meId, users, invites }: { meId: string; users: U[]; invites: Inv[] }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState("");
  const close = () => { setModal(null); router.refresh(); };
  const active = users.filter((u) => u.status === "active").length;

  const confirm = (m: Omit<Extract<Modal, { k: "confirm" }>, "k">) => setModal({ k: "confirm", ...m });
  const act = (fn: () => Promise<{ ok: boolean; data: { error?: string } }>) => async () => {
    const r = await fn();
    return r.ok ? undefined : apiError(r.data.error);
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.users.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.users.summary", { active, disabled: users.length - active, pending: invites.length })}</p>
        </div>
        <Button onClick={() => setModal({ k: "invite" })}>{t("admin.users.invite")}</Button>
      </div>
      {notice && <div className="mt-4"><Alert tone="warn">{notice}</Alert></div>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-sidebar">
        <table className="w-full text-left text-sm">
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">{t("admin.users.colUser")}</th><th className="px-4 py-3 font-semibold">{t("admin.users.colRole")}</th>
              <th className="px-4 py-3 font-semibold">{t("admin.users.colStatus")}</th><th className="px-4 py-3 font-semibold">{t("admin.users.colLast")}</th>
              <th className="px-4 py-3 text-right font-semibold">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-row)] last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-xs">{u.displayName.slice(0, 1).toUpperCase()}</span>
                    <div><div>{u.displayName}{u.id === meId && <span className="ml-2 text-xs text-muted">{t("common.you")}</span>}</div><div className="text-xs text-muted">{u.email}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="px-4 py-3">{u.status === "active" ? t("common.active") : <span className="text-red-300">{t("common.disabled")}</span>}</td>
                <td className="px-4 py-3 text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(DATE_LOCALE[locale]) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {u.status === "active" ? (
                      <>
                        <Button variant="ghost" className="min-h-9 px-3" onClick={() => confirm({
                          title: t("admin.users.changeRole"), label: t("common.confirm"), body: t("admin.users.changeRoleBody", { name: u.displayName, role: roleLabel(u.role === "admin" ? "member" : "admin") }),
                          run: act(() => call(`/api/v1/admin/users/${u.id}`, "PATCH", { role: u.role === "admin" ? "member" : "admin" })),
                        })}>{t("admin.users.changeRole")}</Button>
                        <Button variant="ghost" className="min-h-9 px-3" onClick={() => confirm({
                          title: t("admin.users.resetPw"), label: t("admin.users.resetPw"), body: t("admin.users.resetPwBody", { name: u.displayName }),
                          run: async () => {
                            const r = await call(`/api/v1/admin/users/${u.id}/reset-password`, "POST");
                            if (!r.ok) return apiError(r.data.error);
                            setModal({ k: "temp", name: u.displayName, password: r.data.temporaryPassword });
                          },
                        })}>{t("admin.users.resetPw")}</Button>
                        {u.id !== meId && <Button variant="ghost" className="min-h-9 px-3 text-red-300" onClick={() => confirm({
                          title: t("admin.users.disable"), danger: true, label: t("admin.users.disable"), body: t("admin.users.disableBody", { name: u.displayName }),
                          run: act(() => call(`/api/v1/admin/users/${u.id}`, "PATCH", { status: "disabled" })),
                        })}>{t("admin.users.disable")}</Button>}
                      </>
                    ) : (
                      <Button variant="secondary" className="min-h-9 px-3" onClick={async () => { await call(`/api/v1/admin/users/${u.id}`, "PATCH", { status: "active" }); router.refresh(); }}>{t("admin.users.enable")}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invites.map((i) => (
              <tr key={i.id} className="border-b border-[var(--border-row)] last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span aria-hidden className="h-8 w-8 rounded-full border border-dashed border-line" /><div className="text-muted">{i.email}</div></div></td>
                <td className="px-4 py-3">{roleLabel(i.role)}</td>
                <td className="px-4 py-3"><span className="text-accent"><span aria-hidden>● </span>{t("admin.users.pending")}</span></td>
                <td className="px-4 py-3 text-xs text-muted">{t("admin.users.expires", { date: new Date(i.expiresAt).toLocaleDateString(DATE_LOCALE[locale]) })}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" className="min-h-9 px-3" onClick={async () => { await call(`/api/v1/admin/invites/${i.id}`, "DELETE"); router.refresh(); }}>{t("admin.users.revokeInvite")}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.k === "invite" && <InviteDialog onClose={() => setModal(null)} onDone={(r) => { setNotice(""); setModal({ k: "invite-result", ...r }); }} />}
      {modal?.k === "invite-result" && (
        <Dialog title={t("admin.users.inviteCreated")} onClose={close}>
          <div className="space-y-4">
            <Alert tone="info">{t("admin.users.inviteLead")} <b>{modal.email}</b> {t("admin.users.inviteAs")} {roleLabel(modal.role)}</Alert>
            <CopyBox value={modal.link} />
            <Alert tone="warn">{t("admin.users.linkOnce")}</Alert>
            <p className="text-xs text-muted">{t("admin.users.linkNote")}</p>
            <div className="flex justify-end"><Button onClick={close}>{t("common.done")}</Button></div>
          </div>
        </Dialog>
      )}
      {modal?.k === "temp" && (
        <Dialog title={t("admin.users.tempPw")} onClose={close}>
          <div className="space-y-4">
            <p className="text-sm text-text-2">{t("admin.users.tempPwOf")} <b>{modal.name}</b></p>
            <CopyBox value={modal.password} />
            <Alert tone="warn">{t("admin.users.tempPwNote")}</Alert>
            <div className="flex justify-end"><Button onClick={close}>{t("common.done")}</Button></div>
          </div>
        </Dialog>
      )}
      {modal?.k === "confirm" && <ConfirmDialog m={modal} onClose={() => setModal(null)} onDone={close} />}
    </>
  );
}

function ConfirmDialog({ m, onClose, onDone }: { m: Extract<Modal, { k: "confirm" }>; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog title={m.title} onClose={onClose} width={460}>
      <div className="space-y-4">
        <p className="text-sm text-text-2">{m.body}</p>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant={m.danger ? "danger" : "primary"} disabled={busy} onClick={async () => {
            setBusy(true);
            const e = await m.run();
            if (e) { setErr(e); setBusy(false); } else onDone();
          }}>{m.label}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: (r: { email: string; role: string; link: string }) => void }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await call("/api/v1/admin/invites", "POST", { email, role });
    if (r.ok) return onDone(r.data);
    setErr(r.data.error === "user_exists" && r.data.disabled ? t("admin.users.existsDisabled") : apiError(r.data.error, "admin.users.inviteFailed"));
    setBusy(false);
  }
  return (
    <Dialog title={t("admin.users.inviteTitle")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <Field label={t("admin.users.email")} type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] font-semibold text-muted">{t("admin.users.colRole")}</legend>
          {(["member", "admin"] as const).map((r) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} /> {roleLabel(r)}
            </label>
          ))}
        </fieldset>
        <Alert tone="info">{t("admin.users.noEmail")}</Alert>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={busy || !email}>{t("admin.users.createLink")}</Button>
        </div>
      </form>
    </Dialog>
  );
}
