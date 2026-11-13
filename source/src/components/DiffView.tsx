"use client";
import { useT } from "@/components/LocaleProvider";
import type { DiffRow, FieldChange } from "@/lib/item-history";
import type { MsgKey } from "@/lib/i18n/messages";

const FIELD_LABEL: Record<FieldChange["field"], MsgKey> = { title: "diff.title", summary: "diff.summary", kinds: "diff.kinds", tags: "diff.tags" };
const CELL: Record<string, string> = {
  same: "text-text-2",
  removed: "bg-red-500/10 text-red-200",
  added: "bg-emerald-500/10 text-emerald-200",
};

/** การเปลี่ยนแปลงของฟิลด์สั้น (ชื่อ, คำอธิบาย, ป้าย, tag) */
export function FieldChanges({ changes }: { changes: FieldChange[] }) {
  const t = useT();
  if (!changes.length) return null;
  return (
    <ul className="space-y-1.5 rounded-xl border border-line bg-sidebar p-4 text-sm">
      {changes.map((c) => (
        <li key={c.field} className="flex flex-wrap items-baseline gap-2">
          <span className="w-28 shrink-0 text-xs font-semibold text-muted">{t(FIELD_LABEL[c.field])}</span>
          <span className="rounded bg-red-500/10 px-1.5 text-red-200 line-through decoration-red-300/50">{c.before || "—"}</span>
          <span aria-hidden className="text-muted">→</span>
          <span className="rounded bg-emerald-500/10 px-1.5 text-emerald-200">{c.after || "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/** diff เนื้อหาแบบ side-by-side (ซ้าย = เวอร์ชันก่อนหน้า, ขวา = เวอร์ชันที่เลือก) บรรทัดยาวตัดขึ้นบรรทัดใหม่ */
export function BodyDiff({ rows, leftLabel, rightLabel }: { rows: DiffRow[]; leftLabel: string; rightLabel: string }) {
  const t = useT();
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{t("diff.emptyBoth")}</p>;
  const changed = rows.some((r) => r.left?.kind !== "same" || r.right?.kind !== "same");
  const side = (c: DiffRow["left"], n: number) => (
    <div className={`flex min-w-0 ${c ? CELL[c.kind] : "bg-surface"}`}>
      <span aria-hidden className="w-10 shrink-0 select-none pr-2 text-right font-mono text-[11px] leading-7 text-faint">{c ? n : ""}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-7">{c?.text}</span>
    </div>
  );
  let l = 0, r = 0;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-code">
      <div className="grid grid-cols-2 border-b border-line bg-sidebar text-xs text-muted">
        <div className="px-3 py-2">{leftLabel}</div>
        <div className="border-l border-line px-3 py-2">{rightLabel}</div>
      </div>
      {!changed && <p className="border-b border-[var(--border-row)] px-3 py-2 text-xs text-muted">{t("diff.bodySame")}</p>}
      <div>
        {rows.map((row, i) => {
          if (row.left) l++;
          if (row.right) r++;
          return (
            <div key={i} className="grid grid-cols-2 [&>div:last-child]:border-l [&>div:last-child]:border-line">
              {side(row.left, l)}{side(row.right, r)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
