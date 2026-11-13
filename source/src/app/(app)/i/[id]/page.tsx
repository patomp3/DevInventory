import Link from "next/link";
import { ItemActions } from "./ItemActions";
import { AttachmentList } from "@/components/AttachmentList";
import { RecentTracker } from "@/components/CommandPalette";
import { KindChips } from "@/components/KindChips";
import { MarkdownView } from "@/components/MarkdownView";
import { TagChips } from "@/components/TagChips";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { orNotFound, requireCtx } from "@/lib/auth/session";
import { listAttachments } from "@/lib/attachments";
import { listWritableCollections } from "@/lib/collections";
import { getItemDetail } from "@/lib/items";
import { getT } from "@/lib/i18n/server";
import { DATE_LOCALE } from "@/lib/i18n/locales";

/** หน้ารายละเอียด (ui-design §7.4) — ทุกรายการเป็น Note: เนื้อหา Markdown (code fence มี highlight + Copy) */
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, user } = await requireCtx();
  const { t, locale } = await getT();
  const item = await orNotFound(getItemDetail(ctx, id));
  const [targets, files] = await Promise.all([item.canManage ? listWritableCollections(ctx) : Promise.resolve([]), listAttachments(ctx, id)]);
  return (
    <article>
      <RecentTracker userKey={user.id} id={id} title={item.title} />
      <nav aria-label="breadcrumb" className="mb-2 text-xs text-muted">
        {item.breadcrumb.length === 0 ? <Link href="/inbox" className="hover:text-text">Inbox</Link> : item.breadcrumb.map((b) => <span key={b.id}><Link href={`/c/${b.id}`} className="hover:text-text">{b.name}</Link> / </span>)}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <KindChips kinds={item.kinds} />
            <VisibilityBadge value={item.effectiveVisibility} />
          </div>
          <h1 className="break-words text-2xl font-semibold">{item.title}</h1>
          <p className="mt-1 text-xs text-muted">{t("item.meta", { owner: item.ownerName, when: item.updatedAt.toLocaleString(DATE_LOCALE[locale]), v: item.version })}</p>
        </div>
        <ItemActions id={id} canEdit={item.canEdit} canManage={item.canManage} visibility={item.visibility} effective={item.effectiveVisibility}
          hasCollection={!!item.collectionId} collectionId={item.collectionId} targets={targets.map((t) => ({ id: t.id, name: t.name, level: t.level, path: t.path }))} />
      </div>
      {item.summary && <p className="mt-4 text-text-2">{item.summary}</p>}
      {item.tags.length > 0 && <div className="mt-3"><TagChips tags={item.tags} /></div>}
      {item.body
        ? <div className="mt-6 rounded-xl border border-line bg-sidebar p-5"><MarkdownView source={item.body} /></div>
        : <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{t("item.noContent")}</p>}
      <AttachmentList items={files} />
    </article>
  );
}
