"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KindChips } from "@/components/KindChips";
import { useLocale, useT } from "@/components/LocaleProvider";
import { DATE_LOCALE } from "@/lib/i18n/locales";
import { api } from "@/components/PermissionDialog";
import { Alert, Button, ConfirmDialog } from "@/components/ui";
import type { Kind } from "@/lib/item-content";

type Row = { id: string; title: string; kinds: Kind[]; ownerName: string; deletedByName: string | null; deletedAt: string; daysLeft: number };

/** หน้าถังขยะ (ui-design §1.1): ชื่อ · ป้าย · ลบโดย · ลบเมื่อ · "เหลืออีก N วัน" · กู้คืน / ลบถาวร (ยืนยันก่อน) */
export function TrashClient({ rows, days, isAdmin }: { rows: Row[]; days: number; isAdmin: boolean }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [purge, setPurge] = useState<Row | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  async function restore(r: Row) {
    setBusy(r.id); setErr(""); setNote("");
    const res = await api(`/api/v1/items/${r.id}/restore`, "POST");
    setBusy("");
    if (!res.ok) return setErr(res.error!);
    if (res.data.movedToInbox) setNote(t("trash.restoredInbox", { title: r.title }));
    else setNote(t("trash.restored", { title: r.title }));
    router.refresh();
  }

  async function doPurge() {
    if (!purge) return;
    setBusy(purge.id); setErr("");
    const res = await api(`/api/v1/trash/${purge.id}`, "DELETE");
    setBusy("");
    if (!res.ok) return setErr(res.error!);
    setPurge(null);
    router.refresh();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(DATE_LOCALE[locale], { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("trash.title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("trash.desc", { days })}
          {isAdmin && ` · ${t("trash.adminNote")}`}
        </p>
      </div>
      {err && <Alert>{err}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">{t("trash.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("trash.caption")}</caption>
            <thead className="bg-sidebar text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{t("common.title")}</th><th className="px-4 py-2.5 font-semibold">{t("diff.kinds")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("trash.deletedBy")}</th><th className="px-4 py-2.5 font-semibold">{t("trash.deletedAt")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("trash.left")}</th><th className="px-4 py-2.5 text-right font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border-row)]">
                  <td className="max-w-xs px-4 py-3"><div className="truncate font-medium" title={r.title}>{r.title}</div><div className="text-xs text-muted">{t("trash.owner", { name: r.ownerName })}</div></td>
                  <td className="px-4 py-3"><KindChips kinds={r.kinds} /></td>
                  <td className="px-4 py-3 text-text-2">{r.deletedByName ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-2">{fmt(r.deletedAt)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 ${r.daysLeft <= 3 ? "text-red-300" : "text-text-2"}`}>{t("trash.daysLeft", { n: r.daysLeft })}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="secondary" className="mr-2 min-h-9" disabled={busy === r.id} onClick={() => restore(r)}>{t("common.restore")}</Button>
                    <Button variant="ghost" className="min-h-9 text-red-300" disabled={busy === r.id} onClick={() => setPurge(r)}>{t("common.purge")}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {purge && (
        <ConfirmDialog title={t("common.purge")} confirmLabel={t("common.purge")} danger busy={busy === purge.id} error={err} onConfirm={doPurge} onClose={() => { setPurge(null); setErr(""); }}>
          <p>{t("trash.purgeBody", { title: purge.title })} <b>{t("trash.cannotUndo")}</b></p>
        </ConfirmDialog>
      )}
    </div>
  );
}
