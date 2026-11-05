import Link from "next/link";
import { ItemActions } from "./ItemActions";
import { MarkdownView } from "@/components/MarkdownView";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { orNotFound, requireCtx } from "@/lib/auth/session";
import { listWritableCollections } from "@/lib/collections";
import { getItemDetail } from "@/lib/items";
import { TYPE_LABEL } from "@/lib/visibility-labels";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireCtx();
  const item = await orNotFound(getItemDetail(ctx, id));
  const targets = item.canManage ? await listWritableCollections(ctx) : [];
  return (
    <article>
      <nav aria-label="breadcrumb" className="mb-2 text-xs text-muted">
        {item.breadcrumb.length === 0 ? <Link href="/inbox" className="hover:text-text">Inbox</Link> : item.breadcrumb.map((b) => <span key={b.id}><Link href={`/c/${b.id}`} className="hover:text-text">{b.name}</Link> / </span>)}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-md border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[11px] text-text-2">{TYPE_LABEL[item.type]}</span>
            <VisibilityBadge value={item.effectiveVisibility} />
          </div>
          <h1 className="break-words text-2xl font-semibold">{item.title}</h1>
          <p className="mt-1 text-xs text-muted">โดย {item.ownerName} · แก้ไขล่าสุด {item.updatedAt.toLocaleString("th-TH")} · v{item.version}</p>
        </div>
        <ItemActions id={id} canEdit={item.canEdit} canManage={item.canManage} visibility={item.visibility} effective={item.effectiveVisibility}
          hasCollection={!!item.collectionId} collectionId={item.collectionId} targets={targets.map((t) => ({ id: t.id, name: t.name, depth: t.depth }))} />
      </div>
      {item.summary && <p className="mt-4 text-text-2">{item.summary}</p>}
      {item.type === "link" && item.url && (
        <p className="mt-4"><a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-mono text-sm text-accent underline">{item.url}</a></p>
      )}
      {item.body && <div className="mt-6 rounded-xl border border-line bg-sidebar p-5"><MarkdownView source={item.body} /></div>}
    </article>
  );
}
