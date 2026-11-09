"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";

/** เลือกปลายทางแบบ dropdown ที่พิมพ์ค้นหาได้ (combobox): Inbox ก่อน แล้ว Collection → sub-collection (เยื้องตามชั้น) */
export type PickTarget = { id: string; name: string; level: number; path: string };

type Opt = { id: string; label: string; path: string; level: number };

const norm = (s: string) => s.normalize("NFC").toLowerCase().trim();

export function CollectionPicker({ targets, value, onChange, currentId }: {
  targets: PickTarget[]; value: string; onChange: (id: string) => void; currentId: string | null;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const all: Opt[] = useMemo(
    () => [{ id: "", label: "Inbox", path: "Inbox", level: 0 }, ...targets.map((t) => ({ id: t.id, label: t.name, path: t.path, level: t.level }))],
    [targets],
  );
  const selected = all.find((o) => o.id === value) ?? all[0]!;
  const words = norm(q).split(/\s+/).filter(Boolean);
  // ค้นจากเส้นทางเต็ม (ชื่อแม่ › ชื่อลูก) ทุกคำต้องตรง; ผลที่ค้นเจอเรียงตามลำดับเดิมของ tree
  const shown = useMemo(() => (words.length ? all.filter((o) => words.every((w) => norm(o.path).includes(w))) : all), [all, q]);
  const filtering = words.length > 0;

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function pick(o: Opt) { onChange(o.id); setOpen(false); setQ(""); }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) { setOpen(true); return; } setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (open) { e.preventDefault(); const o = shown[active]; if (o) pick(o); } }
    else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); setQ(""); } // ปิดรายการก่อน ไม่ปิด dialog
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label="ค้นหาปลายทาง"
        aria-activedescendant={open && shown[active] ? `${uid}-o${active}` : undefined}
        value={open ? q : selected.path} placeholder={open ? `พิมพ์เพื่อค้นหา (${all.length - 1} Collection)` : undefined}
        onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={onKey}
        className="min-h-11 w-full rounded-[10px] border border-line bg-code px-3 pr-9 text-sm"
      />
      <button type="button" tabIndex={-1} aria-label={open ? "ปิดรายการ" : "เปิดรายการ"}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted">{open ? "▴" : "▾"}</button>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label="ปลายทาง"
          className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-sidebar p-1 shadow-[0_12px_32px_rgba(0,0,0,.5)]">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">ไม่พบ Collection ที่ตรงกับ “{q.trim()}”</li>}
          {shown.map((o, i) => {
            const isSel = o.id === value, isHere = (currentId ?? "") === o.id;
            return (
              <li key={o.id || "inbox"} id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={isSel}
                onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setActive(i)}
                style={{ paddingLeft: 12 + (filtering ? 0 : o.level) * 20 }}
                className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-md py-1 pr-3 text-sm ${i === active ? "bg-surface-hover" : ""} ${isSel ? "text-accent" : "text-text-2"}`}>
                {!filtering && o.level > 0 && <span aria-hidden className="text-muted">└</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{filtering || o.level === 0 ? o.path : o.label}</span>
                  {o.id === "" && <span className="block truncate text-xs text-muted">ไม่อยู่ใน Collection</span>}
                </span>
                {isHere && <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[11px] text-muted">อยู่ที่นี่</span>}
                {isSel && <span aria-hidden className="shrink-0">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
