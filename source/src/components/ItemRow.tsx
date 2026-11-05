import Link from "next/link";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import type { ItemSummary } from "@/lib/items";
import { TYPE_LABEL } from "@/lib/visibility-labels";

export function ItemRow({ item }: { item: ItemSummary }) {
  return (
    <li>
      <Link href={`/i/${item.id}`} className="flex min-h-14 items-center gap-3 rounded-lg border-b border-[var(--border-row)] px-3 py-2.5 hover:bg-surface-hover">
        <span className="rounded-md border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[11px] text-text-2">{TYPE_LABEL[item.type]}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{item.title}</div>
          {item.summary && <div className="truncate text-xs text-muted">{item.summary}</div>}
        </div>
        <VisibilityBadge value={item.effectiveVisibility} />
        <div className="hidden w-40 text-right text-xs text-muted sm:block">
          <div>{item.ownerName}</div>
          <div>{item.updatedAt.toLocaleDateString("th-TH")}</div>
        </div>
      </Link>
    </li>
  );
}

export function ItemList({ items, empty }: { items: ItemSummary[]; empty: string }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{empty}</p>;
  return <ul>{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>;
}
