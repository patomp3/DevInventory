import { ItemEditor } from "@/components/ItemEditor";
import { requireCtx } from "@/lib/auth/session";
import { listWritableCollections } from "@/lib/collections";

export default async function NewPage({ searchParams }: { searchParams: Promise<{ type?: string; c?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await requireCtx();
  const targets = await listWritableCollections(ctx);
  const c = targets.some((t) => t.id === sp.c) ? sp.c! : "";
  return (
    <ItemEditor targets={targets.map((t) => ({ id: t.id, name: t.name, depth: t.depth }))}
      initial={{ type: sp.type === "link" ? "link" : "note", title: "", summary: "", body: "", url: "", collectionId: c }} />
  );
}
