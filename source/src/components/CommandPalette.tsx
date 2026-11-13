"use client";
import { useT } from "@/components/LocaleProvider";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KIND_LABEL, type Kind } from "@/lib/item-content";

type QuickHit = { id: string; title: string; kinds: Kind[]; breadcrumb: string | null };
type Recent = { id: string; title: string };

const recentKey = (userKey: string) => `di-recent:${userKey}`; // แยกตามผู้ใช้ กันชื่อรายการรั่วข้ามบัญชีบนเครื่องเดียวกัน

function readRecent(userKey: string): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(userKey)) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => r && typeof r.id === "string" && typeof r.title === "string").slice(0, 5) : [];
  } catch { return []; }
}

/** บันทึกรายการที่เปิดล่าสุด (ไว้แสดงใน Ctrl+K ตอนยังไม่ได้พิมพ์) — เก็บในเบราว์เซอร์เท่านั้น ใช้ได้โดยไม่ต้องมี localStorage */
export function RecentTracker({ userKey, id, title }: { userKey: string; id: string; title: string }) {
  useEffect(() => {
    try {
      const next = [{ id, title }, ...readRecent(userKey).filter((r) => r.id !== id)].slice(0, 5);
      localStorage.setItem(recentKey(userKey), JSON.stringify(next));
    } catch { /* ไม่มี/ปิด localStorage: ข้าม */ }
  }, [userKey, id, title]);
  return null;
}

const row = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm text-text-2 aria-selected:bg-accent-soft aria-selected:text-accent";

/** ปุ่มค้นหาที่แถบบน + palette Ctrl/⌘+K (design §8.6, ui-design `CommandPalette`) */
export function SearchButton({ userKey }: { userKey: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<QuickHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [sel, setSel] = useState(""); // แถวที่เลือก: ให้เป็นรายการแรกเสมอเมื่อผลเปลี่ยน (Enter = เปิดรายการแรก)
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) { setRecent(readRecent(userKey)); } else { setQ(""); setHits([]); } }, [open, userKey]);

  // debounce 150 ms ตามสเปก
  useEffect(() => {
    ctl.current?.abort();
    const term = q.trim();
    if (!open || !term) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const c = new AbortController();
    ctl.current = c;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/search/quick?q=${encodeURIComponent(term)}`, { signal: c.signal });
        if (r.ok) setHits((await r.json()).items);
        setLoading(false);
      } catch (e) { if ((e as Error).name !== "AbortError") setLoading(false); }
    }, 150);
    return () => { clearTimeout(t); c.abort(); };
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    setSel(q.trim() ? hits[0]?.id ?? "__all__" : recent[0]?.id ?? "");
  }, [open, q, hits, recent]);

  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);
  const full = () => go(`/search?q=${encodeURIComponent(q.trim())}`);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("palette.buttonLabel")}
        className="flex min-h-10 items-center gap-3 rounded-lg border border-line bg-code px-3 text-sm text-muted hover:bg-surface-hover">
        <span>{t("palette.button")}</span>
        <kbd className="rounded border border-[var(--border-strong)] px-1.5 font-mono text-[11px] text-text-2">Ctrl K</kbd>
      </button>
      <Command.Dialog open={open} onOpenChange={setOpen} label={t("palette.label")} shouldFilter={false} value={sel} onValueChange={setSel}
        overlayClassName="fixed inset-0 z-50 bg-black/60"
        contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[14px] border border-line bg-sidebar shadow-[0_24px_60px_rgba(0,0,0,.55)]"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && q.trim()) { e.preventDefault(); full(); } }}>
        <Command.Input value={q} onValueChange={setQ} placeholder={t("palette.placeholder")} autoFocus
          className="w-full border-b border-line bg-transparent px-4 py-4 text-base text-text outline-none placeholder:text-faint" />
        <Command.List className="max-h-[52vh] overflow-y-auto p-2">
          {q.trim() ? (
            <>
              {hits.length > 0 && (
                <Command.Group heading={t("palette.items")} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
                  {hits.map((h) => (
                    <Command.Item key={h.id} value={h.id} onSelect={() => go(`/i/${h.id}`)} className={row}>
                      <span className="flex gap-1">{h.kinds.map((k) => <span key={k} className="rounded-md border border-[var(--border-strong)] px-1.5 font-mono text-[11px] text-text-2">{KIND_LABEL[k].toLowerCase()}</span>)}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate">{h.title}</span>{h.breadcrumb && <span className="block truncate text-xs text-muted">{h.breadcrumb}</span>}</span>
                      <span aria-hidden className="text-xs text-muted">↵</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!loading && hits.length === 0 && <p className="px-3 py-4 text-sm text-muted">{t("palette.noMatch")}</p>}
              <Command.Item value="__all__" onSelect={full} className={row}>
                <span aria-hidden>🔎</span><span className="flex-1">{t("palette.fullSearch", { q: q.trim() })}</span><kbd className="font-mono text-[11px] text-muted">Ctrl ↵</kbd>
              </Command.Item>
            </>
          ) : recent.length > 0 ? (
            <Command.Group heading={t("palette.recent")} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
              {recent.map((r) => <Command.Item key={r.id} value={r.id} onSelect={() => go(`/i/${r.id}`)} className={row}><span className="truncate">{r.title}</span></Command.Item>)}
            </Command.Group>
          ) : <p className="px-3 py-4 text-sm text-muted">{t("palette.hint")}</p>}
        </Command.List>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-xs text-muted">
          <span><kbd className="font-mono">↑↓</kbd> {t("palette.select")}</span><span><kbd className="font-mono">Enter</kbd> {t("palette.open")}</span><span><kbd className="font-mono">Ctrl Enter</kbd> {t("palette.fullResults")}</span><span><kbd className="font-mono">Esc</kbd> {t("common.close")}</span>
        </div>
      </Command.Dialog>
    </>
  );
}
