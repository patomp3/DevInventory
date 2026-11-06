"use client";
import { useRef, useState } from "react";

/** code block ใน Markdown (ui-design §6 `CodeBlock`): แถบบน "ภาษา · N บรรทัด" + Copy, เลขบรรทัด, เลื่อนแนวนอน */
export function CodePre({ children, "data-language": lang, "data-lines": lines, ...props }:
  React.ComponentProps<"pre"> & { "data-language"?: string; "data-lines"?: number | string }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = ref.current?.querySelector("code")?.textContent ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="code-view overflow-hidden rounded-xl border border-line bg-code">
      <div className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-1.5 text-xs text-muted">
        <span className="font-mono">{lang && lang !== "text" ? lang : "ข้อความ"}</span>
        {lines && <span>· {lines} บรรทัด</span>}
        <span className="ml-auto" />
        <button type="button" onClick={copy} aria-live="polite" className="rounded-md px-2.5 py-1 hover:bg-surface-hover hover:text-text">
          {copied ? "คัดลอกแล้ว" : "Copy"}
        </button>
      </div>
      <pre ref={ref} {...props}>{children}</pre>
    </div>
  );
}
