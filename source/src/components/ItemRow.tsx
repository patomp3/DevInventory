"use client";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { DATE_LOCALE } from "@/lib/i18n/locales";
import { KindChips } from "@/components/KindChips";
import { TagChips } from "@/components/TagChips";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import type { ItemSummary } from "@/lib/items";

export function ItemRow({ item }: { item: ItemSummary }) {
  const locale = useLocale();
  return (
    <li>
      <Link href={`/i/${item.id}`} className="flex min-h-14 items-center gap-3 rounded-lg border-b border-[var(--border-row)] px-3 py-2.5 hover:bg-surface-hover">
        <KindChips kinds={item.kinds} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{item.title}</div>
          {item.summary && <div className="truncate text-xs text-muted">{item.summary}</div>}
          {item.tags.length > 0 && <div className="mt-1"><TagChips tags={item.tags.slice(0, 5)} link={false} /></div>}
        </div>
        <VisibilityBadge value={item.effectiveVisibility} />
        <div className="hidden w-40 text-right text-xs text-muted sm:block">
          <div>{item.ownerName}</div>
          <div>{item.updatedAt.toLocaleDateString(DATE_LOCALE[locale])}</div>
        </div>
      </Link>
    </li>
  );
}

export function ItemList({ items, empty }: { items: ItemSummary[]; empty: string }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{empty}</p>;
  return <ul>{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>;
}
