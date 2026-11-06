import { ItemEditor } from "@/components/ItemEditor";
import { orNotFound, requireCtx } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { listAttachments } from "@/lib/attachments";
import { getItemDetail } from "@/lib/items";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireCtx();
  const it = await orNotFound(getItemDetail(ctx, id));
  if (!it.canEdit) await orNotFound(Promise.reject(new AppError(403, "forbidden")));
  const files = (await listAttachments(ctx, id)).map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size }));
  return (
    <ItemEditor targets={[]} attachments={files} initial={{
      id, version: it.version, title: it.title, summary: it.summary ?? "", body: it.body ?? "",
      collectionId: it.collectionId ?? "", kinds: it.kinds, tags: it.tags.map((t) => t.name),
    }} />
  );
}
