import Link from "next/link";
import { KindChips } from "@/components/KindChips";
import { Marked } from "@/components/Marked";
import { TagChips } from "@/components/TagChips";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { requireCtx } from "@/lib/auth/session";
import { KIND_LABEL, KINDS, isKind } from "@/lib/item-content";
import { isEmptyQuery, searchItems, type SearchHit } from "@/lib/search/query";
import { getT } from "@/lib/i18n/server";
import { DATE_LOCALE } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/messages";

type SP = { q?: string; kind?: string; tag?: string; lang?: string; page?: string };

/** ผลค้นหา (ui-design §7.2): ซ้ายผลลัพธ์ ขวา Tag / ภาษา / ไวยากรณ์ค้นหา — จำนวนและ facet มาจากเงื่อนไขชุดเดียวกับผล */
export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { ctx } = await requireCtx();
  const { t, locale } = await getT();
  const page = Math.min(500, Math.max(0, Number(sp.page ?? 0) | 0));
  const input = { q: sp.q ?? "", kind: sp.kind ?? "", tag: sp.tag ?? "", lang: sp.lang ?? "", page };
  const r = await searchItems(ctx, input);
  const empty = isEmptyQuery(r.parsed);

  const href = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const m = { ...input, page: undefined, ...o } as Record<string, string | number | undefined>;
    for (const k of ["q", "kind", "tag", "lang", "page"]) { const v = m[k]; if (v !== undefined && v !== "" && v !== 0 && v !== "0") p.set(k, String(v)); }
    const s = p.toString();
    return `/search${s ? `?${s}` : ""}`;
  };
  const pages = Math.ceil(r.total / r.pageSize);
  const activeKind = sp.kind && isKind(sp.kind) ? sp.kind : "";
  const chip = (on: boolean) => `inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm ${on ? "border-accent bg-accent-soft text-accent" : "border-line text-text-2 hover:bg-surface-hover"}`;
  const kindCount = new Map(r.facets.kinds.map((f) => [f.value, f.count]));

  return (
    <div>
      <form action="/search" className="mb-5 flex gap-2" role="search">
        <input name="q" defaultValue={sp.q ?? ""} aria-label={t("search.queryLabel")} placeholder={t("search.placeholder")}
          className="min-h-11 flex-1 rounded-[10px] border border-line bg-code px-3 text-text placeholder:text-faint" />
        {activeKind && <input type="hidden" name="kind" value={activeKind} />}
        <button className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:brightness-110">{t("search.button")}</button>
      </form>

      {empty ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          {t("search.emptyPrompt1")} <kbd className="rounded border border-[var(--border-strong)] px-1.5 font-mono text-xs">Ctrl K</kbd> {t("search.emptyPrompt2")}
        </div>
      ) : (
        <div className="flex flex-wrap gap-8">
          <div className="min-w-0 flex-[999_1_520px]">
            <h1 className="text-2xl font-semibold">{t("search.found", { n: r.total.toLocaleString(DATE_LOCALE[locale]) })}</h1>
            <p className="mt-1 text-sm text-muted">
              {r.terms.length > 0 ? <>{t("search.allTerms")} {r.terms.map((t) => <code key={t} className="mx-0.5 rounded bg-code px-1 font-mono text-[13px] text-text-2">{t}</code>)}</> : t("search.byFilter")}
              {" "}· {t("search.sortNote")}
            </p>

            <nav aria-label={t("search.kinds")} className="mt-4 flex flex-wrap gap-2">
              <Link href={href({ kind: "" })} className={chip(!activeKind)} aria-current={!activeKind ? "true" : undefined}>{t("common.all")}</Link>
              {KINDS.map((k) => (
                <Link key={k} href={href({ kind: activeKind === k ? "" : k })} className={chip(activeKind === k)} aria-current={activeKind === k ? "true" : undefined}>
                  {KIND_LABEL[k]} <span className="font-mono text-xs text-muted">{kindCount.get(k) ?? 0}</span>
                </Link>
              ))}
            </nav>

            {r.hits.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center">
                <p className="text-sm text-text-2">{t("search.none", { q: r.terms.join(" ") })}</p>
                {r.didYouMean.length > 0 && (
                  <p className="mt-3 text-sm text-muted">{t("search.didYouMean")}{" "}
                    {r.didYouMean.map((d, i) => <span key={d.q}>{i > 0 && " · "}<Link href={href({ q: d.q, kind: "", tag: "", lang: "" })} className="text-accent underline">{d.label}</Link></span>)}
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-3">{r.hits.map((h) => <ResultCard key={h.id} h={h} locale={locale} />)}</ul>
            )}

            {pages > 1 && (
              <nav aria-label={t("search.pages")} className="mt-6 flex items-center justify-between text-sm">
                {page > 0 ? <Link href={href({ page: String(page - 1) })} className={chip(false)}>{t("common.prev")}</Link> : <span />}
                <span className="text-muted">{t("common.page", { page: page + 1, pages })}</span>
                {page + 1 < pages ? <Link href={href({ page: String(page + 1) })} className={chip(false)}>{t("common.next")}</Link> : <span />}
              </nav>
            )}
          </div>

          <aside className="flex-[1_1_260px] space-y-6 lg:max-w-[320px]" aria-label={t("search.filters")}>
            <section aria-labelledby="f-tag">
              <h2 id="f-tag" className="mb-2 text-[13px] font-semibold text-muted">Tag</h2>
              {r.facets.tags.length === 0 ? <p className="text-sm text-muted">—</p> : (
                <ul className="space-y-1">
                  {r.facets.tags.map((t) => (
                    <li key={t.value}><Link href={href({ tag: sp.tag === t.value ? "" : t.value })} className={`flex min-h-9 items-center justify-between rounded-lg px-3 text-sm ${sp.tag === t.value ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"}`}>#{t.label}<span className="font-mono text-xs text-muted">{t.count}</span></Link></li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="f-lang">
              <h2 id="f-lang" className="mb-2 text-[13px] font-semibold text-muted">{t("search.langBlock")}</h2>
              {r.facets.langs.length === 0 ? <p className="text-sm text-muted">—</p> : (
                <ul className="space-y-1">
                  {r.facets.langs.map((l) => (
                    <li key={l.value}><Link href={href({ lang: sp.lang === l.value ? "" : l.value })} className={`flex min-h-9 items-center justify-between rounded-lg px-3 font-mono text-[13px] ${sp.lang === l.value ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"}`}>{l.label}<span className="text-xs text-muted">{l.count}</span></Link></li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="f-syn" className="rounded-xl border border-line bg-sidebar p-4 text-sm">
              <h2 id="f-syn" className="mb-2 text-[13px] font-semibold text-muted">{t("search.syntax")}</h2>
              <ul className="space-y-1 text-text-2">
                {[["docker deploy", t("search.syn.and")], ["\"docker compose\"", t("search.syn.phrase")], ["-test", t("search.syn.not")], ["tag:docker", t("search.syn.tag")], ["kind:script", t("search.syn.kind")], ["lang:bash", t("search.syn.lang")], ["in:\"Project X\"", t("search.syn.in")], ["owner:me", t("search.syn.mine")], ["is:private", t("search.syn.private")]].map(([c, d]) => (
                  <li key={c} className="flex justify-between gap-3"><code className="font-mono text-[13px] text-accent">{c}</code><span className="text-xs text-muted">{d}</span></li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function ResultCard({ h, locale }: { h: SearchHit; locale: Locale }) {
  const ex = h.snippet.excerpt;
  const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(locale, k, p);
  return (
    <li className="rounded-xl border border-line bg-sidebar p-4">
      {h.breadcrumb.length > 0 && (
        <nav aria-label="breadcrumb" className="mb-1 text-xs text-muted">
          {h.breadcrumb.map((b, i) => <span key={b.id}>{i > 0 && " / "}<Link href={`/c/${b.id}`} className="hover:text-text">{b.name}</Link></span>)}
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <KindChips kinds={h.kinds} />
        <Link href={`/i/${h.id}`} className="min-w-0 break-words text-[15px] font-medium text-text hover:text-accent"><Marked segs={h.snippet.title} /></Link>
        <span className="ml-auto"><VisibilityBadge value={h.effectiveVisibility} /></span>
      </div>
      {ex && (ex.kind === "code" ? (
        <div className="mt-2 flex overflow-x-auto rounded-lg bg-code py-1.5 font-mono text-[13px] leading-7">
          <span aria-label={t("search.line", { n: ex.line })} className="w-12 shrink-0 select-none pr-3 text-right text-xs text-faint">{ex.line}</span>
          <span className="whitespace-pre pr-3 text-text-2"><Marked segs={ex.segments} /></span>
          {ex.lang && <span className="ml-auto shrink-0 pr-3 text-xs text-muted">{ex.lang}</span>}
        </div>
      ) : <p className="mt-2 break-words text-sm text-text-2"><Marked segs={ex.segments} /></p>)}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        {h.tags.length > 0 && <TagChips tags={h.tags.slice(0, 5)} link={false} />}
        <span className="ml-auto">{h.ownerName} · {h.updatedAt.toLocaleDateString(DATE_LOCALE[locale])}</span>
      </div>
    </li>
  );
}
