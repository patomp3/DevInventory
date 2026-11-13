import Link from "next/link";
import { notFound } from "next/navigation";
import { auditFilterOptions, AUDIT_PAGE_SIZE, queryAudit } from "@/lib/admin-audit";
import { actionLabel, isIsoDay, summarizeDetail } from "@/lib/audit-format";
import { getSessionUser, toCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { DATE_LOCALE } from "@/lib/i18n/locales";

type SP = { action?: string; user?: string; from?: string; to?: string; page?: string };

/** Admin › Audit log (ui-design §7.11): FilterBar + ตาราง + Export CSV */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") notFound();
  const ctx = toCtx(me);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const f = { action: sp.action || undefined, userId: sp.user || undefined, from: isIsoDay(sp.from) ? sp.from : undefined, to: isIsoDay(sp.to) ? sp.to : undefined };
  const page = Math.min(10_000, Math.max(0, Number(sp.page ?? 0) | 0));
  const [{ rows, total }, opts] = await Promise.all([queryAudit(ctx, f, page), auditFilterOptions(ctx)]);
  const pages = Math.ceil(total / AUDIT_PAGE_SIZE);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ action: f.action, user: f.userId, from: f.from, to: f.to, ...o })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const field = "min-h-10 rounded-[10px] border border-line bg-code px-3 text-sm text-text";
  const fmt = (d: Date) => d.toLocaleString(DATE_LOCALE[locale], { dateStyle: "short", timeStyle: "medium" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-muted">{t("audit.summary", { n: total.toLocaleString(DATE_LOCALE[locale]) })}</p>
        </div>
        <a href={`/api/v1/admin/audit-logs${qs({ format: "csv" })}`} className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm text-text-2 hover:bg-surface-hover">Export CSV</a>
      </div>

      <form method="get" role="search" aria-label={t("audit.filters")} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-sidebar p-4">
        <label className="space-y-1 text-xs text-muted">action
          <select name="action" defaultValue={f.action ?? ""} className={`${field} block`}>
            <option value="">{t("common.all")}</option>{opts.actions.map((a) => <option key={a} value={a}>{actionLabel(a, locale)} ({a})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted">{t("audit.actor")}
          <select name="user" defaultValue={f.userId ?? ""} className={`${field} block`}>
            <option value="">{t("audit.everyone")}</option>{opts.actors.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted">{t("audit.from")}<input type="date" name="from" defaultValue={f.from ?? ""} className={`${field} block`} /></label>
        <label className="space-y-1 text-xs text-muted">{t("audit.to")}<input type="date" name="to" defaultValue={f.to ?? ""} className={`${field} block`} /></label>
        <button className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-110">{t("common.filter")}</button>
        <Link href="/admin/audit" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-muted hover:bg-surface-hover">{t("common.clear")}</Link>
      </form>

      {rows.length === 0 ? <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{t("audit.none")}</p> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="bg-sidebar text-left text-xs text-muted">
              <tr><th className="px-4 py-2.5 font-semibold">{t("audit.colTime")}</th><th className="px-4 py-2.5 font-semibold">{t("audit.actor")}</th><th className="px-4 py-2.5 font-semibold">action</th><th className="px-4 py-2.5 font-semibold">{t("audit.colDetail")}</th><th className="px-4 py-2.5 font-semibold">IP</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border-row)] align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-text-2">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-2.5"><div>{r.actorName ?? <span className="text-muted">{t("common.system")}</span>}</div>{r.actorEmail && <div className="text-xs text-muted">{r.actorEmail}</div>}</td>
                  <td className="px-4 py-2.5"><div>{actionLabel(r.action, locale)}</div><code className="font-mono text-[11px] text-muted">{r.action}</code></td>
                  <td className="max-w-md break-words px-4 py-2.5 font-mono text-xs text-text-2">{summarizeDetail(r, 160, locale) || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t("audit.pages")} className="flex items-center justify-between text-sm">
          {page > 0 ? <Link href={`/admin/audit${qs({ page: String(page - 1) })}`} className="rounded-lg border border-line px-3 py-2 text-text-2 hover:bg-surface-hover">{t("audit.newer")}</Link> : <span />}
          <span className="text-muted">{t("common.page", { page: page + 1, pages })}</span>
          {page + 1 < pages ? <Link href={`/admin/audit${qs({ page: String(page + 1) })}`} className="rounded-lg border border-line px-3 py-2 text-text-2 hover:bg-surface-hover">{t("audit.older")}</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
