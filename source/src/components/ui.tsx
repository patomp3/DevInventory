"use client";
import { useT } from "@/components/LocaleProvider";
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
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  // เก็บ onClose ล่าสุดไว้ใน ref: ผู้เรียกส่งฟังก์ชันใหม่ทุกครั้งที่ render ถ้าใส่ใน deps ของ effect
  // จะ focus ซ้ำทุกครั้งที่พิมพ์ (โฟกัสเด้งไปที่ปุ่ม ✕) — ต้อง focus เฉพาะตอนเปิด dialog ครั้งเดียว
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // ช่องกรอก/select ก่อน (ไม่ใช่ปุ่ม ✕ ที่อยู่แรกสุดใน DOM); ไม่มีช่องกรอกจึงค่อยเป็นปุ่ม
    const root = ref.current;
    (root?.querySelector<HTMLElement>("input:not([type=hidden]),textarea,select") ?? root?.querySelector<HTMLElement>("button:not([data-dialog-close])") ?? root?.querySelector<HTMLElement>("button"))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}
        className="w-full rounded-[14px] border border-line bg-sidebar p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} data-dialog-close aria-label={t("common.close")} className="rounded-md px-2 py-1 text-muted hover:bg-surface-hover">✕</button>
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

/** Dialog ยืนยัน (ui-design: ชื่อ + ประโยคบอกผลที่ตามมา + ยกเลิก / ปุ่มยืนยัน; ปุ่มทำลายใช้สีแดง) */
export function ConfirmDialog({ title, children, confirmLabel, danger = false, busy = false, error, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string;
  onConfirm: () => void; onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog title={title} onClose={() => !busy && onClose()} width={480}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="space-y-2 text-sm text-text-2">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </Dialog>
  );
}
