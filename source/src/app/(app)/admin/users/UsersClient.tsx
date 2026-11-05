"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, CopyBox, Dialog, Field } from "@/components/ui";

type U = { id: string; email: string; displayName: string; role: "admin" | "member"; status: string; lastLoginAt: string | null };
type Inv = { id: string; email: string; role: "admin" | "member"; expiresAt: string };
type Modal =
  | { k: "invite" }
  | { k: "invite-result"; email: string; role: string; link: string }
  | { k: "confirm"; title: string; body: string; danger?: boolean; label: string; run: () => Promise<string | void> }
  | { k: "temp"; name: string; password: string };

const roleLabel = (r: string) => (r === "admin" ? "Admin" : "Member");
const errText: Record<string, string> = {
  user_exists: "อีเมลนี้มีบัญชีอยู่แล้ว", invite_pending: "อีเมลนี้มีคำเชิญค้างอยู่ ให้ยกเลิกคำเชิญเดิมก่อน", invalid_email: "รูปแบบอีเมลไม่ถูกต้อง",
  last_admin: "ต้องมี Admin ที่ใช้งานอยู่อย่างน้อย 1 คน", cannot_demote_self: "ปิดบัญชีหรือลดสิทธิ์ตัวเองไม่ได้",
};

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function UsersClient({ meId, users, invites }: { meId: string; users: U[]; invites: Inv[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState("");
  const close = () => { setModal(null); router.refresh(); };
  const active = users.filter((u) => u.status === "active").length;

  const confirm = (m: Omit<Extract<Modal, { k: "confirm" }>, "k">) => setModal({ k: "confirm", ...m });
  const act = (fn: () => Promise<{ ok: boolean; data: { error?: string } }>) => async () => {
    const r = await fn();
    return r.ok ? undefined : errText[r.data.error ?? ""] ?? "ดำเนินการไม่สำเร็จ";
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ผู้ใช้</h1>
          <p className="mt-1 text-sm text-muted">ใช้งาน {active} · ปิดบัญชี {users.length - active} · รอรับเชิญ {invites.length}</p>
        </div>
        <Button onClick={() => setModal({ k: "invite" })}>เชิญด้วยอีเมล</Button>
      </div>
      {notice && <div className="mt-4"><Alert tone="warn">{notice}</Alert></div>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-sidebar">
        <table className="w-full text-left text-sm">
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">ผู้ใช้</th><th className="px-4 py-3 font-semibold">บทบาท</th>
              <th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3 font-semibold">เข้าใช้ล่าสุด</th>
              <th className="px-4 py-3 text-right font-semibold">การกระทำ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-row)] last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-xs">{u.displayName.slice(0, 1).toUpperCase()}</span>
                    <div><div>{u.displayName}{u.id === meId && <span className="ml-2 text-xs text-muted">(คุณ)</span>}</div><div className="text-xs text-muted">{u.email}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="px-4 py-3">{u.status === "active" ? "ใช้งาน" : <span className="text-red-300">ปิดบัญชี</span>}</td>
                <td className="px-4 py-3 text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH") : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {u.status === "active" ? (
                      <>
                        <Button variant="ghost" className="min-h-9 px-3" onClick={() => confirm({
                          title: "เปลี่ยนบทบาท", label: "ยืนยัน", body: `เปลี่ยน ${u.displayName} เป็น ${roleLabel(u.role === "admin" ? "member" : "admin")}?`,
                          run: act(() => call(`/api/v1/admin/users/${u.id}`, "PATCH", { role: u.role === "admin" ? "member" : "admin" })),
                        })}>เปลี่ยนบทบาท</Button>
                        <Button variant="ghost" className="min-h-9 px-3" onClick={() => confirm({
                          title: "รีเซ็ตรหัสผ่าน", label: "รีเซ็ตรหัสผ่าน", body: `สร้างรหัสผ่านชั่วคราวให้ ${u.displayName} — ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์และต้องตั้งรหัสใหม่ตอน login`,
                          run: async () => {
                            const r = await call(`/api/v1/admin/users/${u.id}/reset-password`, "POST");
                            if (!r.ok) return errText[r.data.error] ?? "ดำเนินการไม่สำเร็จ";
                            setModal({ k: "temp", name: u.displayName, password: r.data.temporaryPassword });
                          },
                        })}>รีเซ็ตรหัสผ่าน</Button>
                        {u.id !== meId && <Button variant="ghost" className="min-h-9 px-3 text-red-300" onClick={() => confirm({
                          title: "ปิดบัญชี", danger: true, label: "ปิดบัญชี", body: `ปิดบัญชีของ ${u.displayName}? session ทั้งหมดจะหลุดทันที`,
                          run: act(() => call(`/api/v1/admin/users/${u.id}`, "PATCH", { status: "disabled" })),
                        })}>ปิดบัญชี</Button>}
                      </>
                    ) : (
                      <Button variant="secondary" className="min-h-9 px-3" onClick={async () => { await call(`/api/v1/admin/users/${u.id}`, "PATCH", { status: "active" }); router.refresh(); }}>เปิดบัญชี</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invites.map((i) => (
              <tr key={i.id} className="border-b border-[var(--border-row)] last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span aria-hidden className="h-8 w-8 rounded-full border border-dashed border-line" /><div className="text-muted">{i.email}</div></div></td>
                <td className="px-4 py-3">{roleLabel(i.role)}</td>
                <td className="px-4 py-3"><span className="text-accent"><span aria-hidden>● </span>รอรับเชิญ</span></td>
                <td className="px-4 py-3 text-xs text-muted">หมดอายุ {new Date(i.expiresAt).toLocaleDateString("th-TH")}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" className="min-h-9 px-3" onClick={async () => { await call(`/api/v1/admin/invites/${i.id}`, "DELETE"); router.refresh(); }}>ยกเลิกคำเชิญ</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.k === "invite" && <InviteDialog onClose={() => setModal(null)} onDone={(r) => { setNotice(""); setModal({ k: "invite-result", ...r }); }} />}
      {modal?.k === "invite-result" && (
        <Dialog title="สร้างลิงก์เชิญแล้ว" onClose={close}>
          <div className="space-y-4">
            <Alert tone="info">เชิญ <b>{modal.email}</b> เป็น {roleLabel(modal.role)}</Alert>
            <CopyBox value={modal.link} />
            <Alert tone="warn">ลิงก์นี้แสดงเต็มได้ครั้งเดียว ถ้าลืม copy ให้ยกเลิกคำเชิญแล้วสร้างใหม่</Alert>
            <p className="text-xs text-muted">ใช้ได้ครั้งเดียว หมดอายุใน 7 วัน และใช้ได้กับอีเมลนี้เท่านั้น</p>
            <div className="flex justify-end"><Button onClick={close}>เสร็จสิ้น</Button></div>
          </div>
        </Dialog>
      )}
      {modal?.k === "temp" && (
        <Dialog title="รหัสผ่านชั่วคราว" onClose={close}>
          <div className="space-y-4">
            <p className="text-sm text-text-2">รหัสผ่านชั่วคราวของ <b>{modal.name}</b></p>
            <CopyBox value={modal.password} />
            <Alert tone="warn">แสดงครั้งเดียว ส่งให้ผู้ใช้เอง ผู้ใช้ต้องตั้งรหัสใหม่ตอน login ครั้งแรก</Alert>
            <div className="flex justify-end"><Button onClick={close}>เสร็จสิ้น</Button></div>
          </div>
        </Dialog>
      )}
      {modal?.k === "confirm" && <ConfirmDialog m={modal} onClose={() => setModal(null)} onDone={close} />}
    </>
  );
}

function ConfirmDialog({ m, onClose, onDone }: { m: Extract<Modal, { k: "confirm" }>; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog title={m.title} onClose={onClose} width={460}>
      <div className="space-y-4">
        <p className="text-sm text-text-2">{m.body}</p>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await call("/api/v1/admin/invites", "POST", { email, role });
    if (r.ok) return onDone(r.data);
    setErr(r.data.error === "user_exists" && r.data.disabled ? "อีเมลนี้มีบัญชีอยู่แล้ว (ปิดบัญชีอยู่) ให้ไป \"เปิดบัญชี\" แทน" : errText[r.data.error] ?? "สร้างคำเชิญไม่สำเร็จ");
    setBusy(false);
  }
  return (
    <Dialog title="เชิญด้วยอีเมล" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <Field label="อีเมล" type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] font-semibold text-muted">บทบาท</legend>
          {(["member", "admin"] as const).map((r) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} /> {roleLabel(r)}
            </label>
          ))}
        </fieldset>
        <Alert tone="info">ไม่มีการส่งอีเมลในเฟส 1 ระบบจะสร้างลิงก์ให้ copy ส่งเอง</Alert>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" disabled={busy || !email}>สร้างลิงก์เชิญ</Button>
        </div>
      </form>
    </Dialog>
  );
}
