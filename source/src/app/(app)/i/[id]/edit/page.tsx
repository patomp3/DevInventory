import { ItemEditor } from "@/components/ItemEditor";
import { orNotFound, requireCtx } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getItemDetail } from "@/lib/items";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireCtx();
  const it = await orNotFound(getItemDetail(ctx, id));
  if (!it.canEdit) await orNotFound(Promise.reject(new AppError(403, "forbidden")));
  return (
    <ItemEditor targets={[]} initial={{ id, version: it.version, type: it.type === "link" ? "link" : "note", title: it.title, summary: it.summary ?? "", body: it.body ?? "", url: it.url ?? "", collectionId: it.collectionId ?? "" }} />
  );
}
