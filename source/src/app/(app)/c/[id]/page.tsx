import Link from "next/link";
import { CollectionActions } from "./CollectionActions";
import { ItemList } from "@/components/ItemRow";
import { NewCollectionButton } from "@/components/CollectionDialog";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { orNotFound, requireCtx } from "@/lib/auth/session";
import { listTree, loadCollection } from "@/lib/collections";
import { db } from "@/lib/db";
import { listItems } from "@/lib/items";
import { canEdit, canManage } from "@/lib/permissions";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireCtx();
  const c = await orNotFound(loadCollection(db(), ctx, id));
  const [items, tree] = await Promise.all([listItems(ctx, { kind: "collection", id }), listTree(ctx)]);
  const kids = tree.filter((t) => t.parentId === id);
  const crumbs: { id: string; name: string }[] = [];
  for (let p = tree.find((t) => t.id === id)?.parentId; p; ) {
    const n = tree.find((t) => t.id === p);
    if (!n) break;
    crumbs.unshift({ id: n.id, name: n.name }); p = n.parentId;
  }
  const manage = canManage(ctx, c), edit = canEdit(ctx, c);
  return (
    <>
      <nav aria-label="breadcrumb" className="mb-2 text-xs text-muted">
        {crumbs.map((b) => <span key={b.id}><Link href={`/c/${b.id}`} className="hover:text-text">{b.name}</Link> / </span>)}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted">
            <VisibilityBadge value={c.visibility} />
            {c.visibility === "inherit" && <VisibilityBadge value={c.effectiveVisibility} />}
          </div>
          {c.description && <p className="mt-2 text-sm text-text-2">{c.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {edit && <Link href={`/new?c=${id}`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-110">+ เพิ่มรายการ</Link>}
          {edit && c.depth < 3 && <NewCollectionButton parentId={id} label="+ Collection ย่อย" variant="secondary" />}
          {manage && <CollectionActions id={id} name={c.name} visibility={c.visibility} effective={c.effectiveVisibility} hasParent={!!c.parentId} />}
        </div>
      </div>
      {kids.length > 0 && (
        <section className="mt-6" aria-label="Collection ย่อย">
          <h2 className="mb-2 text-[13px] font-semibold text-muted">Collection ย่อย</h2>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => <Link key={k.id} href={`/c/${k.id}`} className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm hover:bg-surface-hover">{k.name} <span className="font-mono text-xs text-muted">{k.count}</span></Link>)}
          </div>
        </section>
      )}
      <section className="mt-6">
        <ItemList items={items} empty={edit ? "ยังไม่มีรายการ — กด “+ เพิ่มรายการ”" : "ยังไม่มีรายการ"} />
      </section>
    </>
  );
}
