"use client";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
const variants = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary: "border border-line bg-surface text-text-2 hover:bg-surface-hover",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
  ghost: "text-muted hover:bg-surface-hover hover:text-text",
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button {...p} className={`${btn} ${variants[variant]} ${className}`} />;
}

export function Field({ label, hint, right, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; right?: ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">{label}</label>
      <div className="relative">
        <input id={id} {...p} className="min-h-11 w-full rounded-[10px] border border-line bg-code px-3 text-text placeholder:text-faint read-only:text-muted" />
        {right && <div className="absolute inset-y-0 right-2 flex items-center">{right}</div>}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "warn"; children: ReactNode }) {
  const c = { error: "border-red-400/40 bg-red-500/10 text-red-200", info: "border-line bg-surface text-text-2", warn: "border-accent/40 bg-accent-soft text-accent" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] border px-3 py-2.5 text-sm ${c}`}>{children}</div>;
}

export function Dialog({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,button,select")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}
        className="w-full rounded-[14px] border border-line bg-sidebar p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="ปิด" className="rounded-md px-2 py-1 text-muted hover:bg-surface-hover">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CopyBox({ value }: { value: string }) {
  return (
    <div className="flex items-stretch gap-2">
      <code className="min-h-11 flex-1 break-all rounded-[10px] border border-line bg-code px-3 py-2.5 font-mono text-[13px] text-text">{value}</code>
      <Button variant="secondary" onClick={() => navigator.clipboard.writeText(value)}>Copy</Button>
    </div>
  );
}
