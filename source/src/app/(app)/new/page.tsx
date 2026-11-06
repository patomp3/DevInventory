import { ItemEditor } from "@/components/ItemEditor";
import { requireCtx } from "@/lib/auth/session";
import { listWritableCollections } from "@/lib/collections";
import { isKind } from "@/lib/item-content";

/** /new?c=<collection>&kind=<ป้ายเริ่มต้น> — ไม่แยกประเภทรายการแล้ว (D22) */
export default async function NewPage({ searchParams }: { searchParams: Promise<{ kind?: string; c?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await requireCtx();
  const targets = await listWritableCollections(ctx);
  const c = targets.some((t) => t.id === sp.c) ? sp.c! : "";
  const kind = sp.kind && isKind(sp.kind) ? sp.kind : "note";
  return (
    <ItemEditor targets={targets.map((t) => ({ id: t.id, name: t.name, depth: t.depth }))}
      initial={{ title: "", summary: "", body: "", collectionId: c, kinds: [kind], tags: [] }} />
  );
}
