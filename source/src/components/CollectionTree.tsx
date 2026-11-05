"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TreeNode } from "@/lib/collections";
import { VIS_ICON } from "@/lib/visibility-labels";

export function CollectionTree({ nodes }: { nodes: TreeNode[] }) {
  const path = usePathname();
  const render = (parent: string | null, level: number): React.ReactNode =>
    nodes.filter((n) => n.parentId === parent).map((n) => {
      const active = path === `/c/${n.id}`;
      return (
        <li key={n.id}>
          <Link href={`/c/${n.id}`} aria-current={active ? "page" : undefined} style={{ paddingLeft: [10, 28, 46][level] ?? 46 }}
            className={`flex min-h-10 items-center gap-2 rounded-lg pr-3 text-sm ${active ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"}`}>
            <span aria-hidden className="text-xs">{n.icon ?? VIS_ICON[n.effectiveVisibility]}</span>
            <span className="min-w-0 flex-1 truncate">{n.name}</span>
            <span className="font-mono text-xs text-muted">{n.count}</span>
          </Link>
          <ul>{render(n.id, level + 1)}</ul>
        </li>
      );
    });
  if (!nodes.length) return <p className="px-3 text-xs text-muted">ยังไม่มี Collection</p>;
  return <ul aria-label="Collections">{render(null, 0)}</ul>;
}
