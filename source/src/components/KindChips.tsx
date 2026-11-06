import { KIND_LABEL, type Kind } from "@/lib/item-content";

/** ป้ายของรายการ (ui-design §6 `TypeChip` → ป้าย D22): chip mono 11px ขอบ --border-strong */
export function KindChips({ kinds }: { kinds: Kind[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {kinds.map((k) => (
        <span key={k} className="rounded-md border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[11px] text-text-2">{KIND_LABEL[k].toLowerCase()}</span>
      ))}
    </span>
  );
}
