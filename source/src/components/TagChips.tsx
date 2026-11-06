import Link from "next/link";

/** `TagChip` (ui-design §6): พื้น surface-hover ตัวอักษร secondary 12px radius 6 */
export function TagChips({ tags, link = true }: { tags: { name: string; slug: string }[] | string[]; link?: boolean }) {
  if (!tags.length) return null;
  const list = tags.map((t) => (typeof t === "string" ? { name: t, slug: t } : t));
  const cls = "rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-2";
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tag">
      {list.map((t) => (
        <li key={t.slug}>{link ? <Link href={`/tags/${encodeURIComponent(t.slug)}`} className={`${cls} hover:text-text`}>#{t.name}</Link> : <span className={cls}>#{t.name}</span>}</li>
      ))}
    </ul>
  );
}
