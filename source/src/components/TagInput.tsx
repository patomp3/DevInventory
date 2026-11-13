"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { LIMITS, normalizeTag } from "@/lib/item-content";

type Suggestion = { name: string; slug: string; count: number };

/** ช่อง tag (ui-design §6 `TagInput`): chip (× ลบ) + autocomplete จาก /api/v1/tags (กรองตามสิทธิ์ฝั่ง server) */
export function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const tr = useT();
  const id = useId();
  const [text, setText] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const slugs = new Set(value.map(normalizeTag));

  useEffect(() => {
    clearTimeout(timer.current);
    const q = normalizeTag(text);
    if (!q) { setSugs([]); return; }
    const ctl = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/tags?prefix=${encodeURIComponent(q)}&limit=8`, { signal: ctl.signal });
        if (r.ok) { setSugs((await r.json()).tags); setHi(-1); }
      } catch { /* ยกเลิกหรือเครือข่ายล้ม: ไม่ต้องแสดงคำแนะนำ */ }
    }, 150);
    return () => { clearTimeout(timer.current); ctl.abort(); };
  }, [text]);

  const shown = sugs.filter((s) => !slugs.has(s.slug));
  const full = value.length >= LIMITS.tags;

  function add(raw: string) {
    const name = raw.trim().replace(/\s+/g, " ");
    const slug = normalizeTag(name);
    if (!slug || slugs.has(slug) || full) { setText(""); return; }
    onChange([...value, name.slice(0, LIMITS.tagChars)]);
    setText(""); setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (!text.trim() && e.key !== ",") return; // Tab/Enter ว่าง = ทำงานปกติ
      e.preventDefault();
      add(hi >= 0 && shown[hi] ? shown[hi].name : text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "ArrowDown" && shown.length) {
      e.preventDefault(); setOpen(true); setHi((h) => (h + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length) {
      e.preventDefault(); setHi((h) => (h <= 0 ? shown.length - 1 : h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">Tag</label>
      <div className="relative">
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-[10px] border border-line bg-code px-2 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-accent">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface-hover py-0.5 pl-2 pr-1 text-xs text-text-2">
              {t}
              <button type="button" aria-label={tr("tags.remove", { t })} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded px-1 text-muted hover:text-text">×</button>
            </span>
          ))}
          <input id={id} value={text} disabled={full} placeholder={full ? tr("tags.full", { n: LIMITS.tags }) : value.length ? "" : tr("tags.placeholder")}
            onChange={(e) => { setText(e.target.value); setOpen(true); }} onKeyDown={onKey}
            onBlur={() => setTimeout(() => setOpen(false), 120)} onFocus={() => setOpen(true)}
            role="combobox" aria-expanded={open && shown.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
            aria-activedescendant={hi >= 0 ? `${id}-o${hi}` : undefined}
            className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-faint" />
        </div>
        {open && shown.length > 0 && (
          <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[10px] border border-line bg-sidebar py-1 shadow-lg">
            {shown.map((s, i) => (
              <li key={s.slug} id={`${id}-o${i}`} role="option" aria-selected={i === hi}
                onMouseDown={(e) => { e.preventDefault(); add(s.name); }}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${i === hi ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"}`}>
                <span>{s.name}</span><span className="font-mono text-xs text-muted">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted">{tr("tags.hint", { n: LIMITS.tags })}</p>
    </div>
  );
}
