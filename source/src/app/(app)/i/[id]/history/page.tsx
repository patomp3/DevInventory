import Link from "next/link";
import { RestoreButton } from "./RestoreButton";
import { BodyDiff, FieldChanges } from "@/components/DiffView";
import { orNotFound, requireCtx } from "@/lib/auth/session";
import { changedFields, sideBySide } from "@/lib/item-history";
import { getItemDetail } from "@/lib/items";
import { getVersionWithPrev, listVersions } from "@/lib/versions";

/** หน้า History (ui-design §1.1): ซ้ายรายการเวอร์ชัน, ขวา diff ของเวอร์ชันที่เลือกเทียบกับก่อนหน้า */
export default async function HistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx } = await requireCtx();
  const item = await orNotFound(getItemDetail(ctx, id));
  const versions = await listVersions(ctx, id);
  const wanted = Number(sp.v);
  const selected = versions.find((v) => v.version === wanted)?.version ?? versions[0]?.version ?? item.version;
  const sel = await orNotFound(getVersionWithPrev(ctx, id, selected));
  const rows = sideBySide(sel.prev?.view.body ?? null, sel.view.body);
  const changes = changedFields(sel.prev?.view ?? null, sel.view);
  const fmt = (d: Date) => d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  const isCurrent = selected === item.version;

  return (
    <div>
      <nav aria-label="breadcrumb" className="mb-2 text-xs text-muted"><Link href={`/i/${id}`} className="hover:text-text">← กลับไปที่รายการ</Link></nav>
      <h1 className="break-words text-2xl font-semibold">ประวัติ: {item.title}</h1>
      <p className="mt-1 text-xs text-muted">{versions.length} เวอร์ชัน · เวอร์ชันปัจจุบัน v{item.version} · แก้ต่อเนื่องโดยคนเดิมภายใน 5 นาทีรวมเป็นเวอร์ชันเดียว</p>

      <div className="mt-6 flex flex-wrap gap-6">
        <nav aria-label="เวอร์ชัน" className="flex-[0_0_260px]">
          <ul className="space-y-1">
            {versions.map((v) => {
              const on = v.version === selected;
              return (
                <li key={v.version}>
                  <Link href={`/i/${id}/history?v=${v.version}`} aria-current={on ? "true" : undefined}
                    className={`block rounded-lg border px-3 py-2 ${on ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-hover"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-sm ${on ? "text-accent" : "text-text"}`}>v{v.version}</span>
                      {v.version === item.version && <span className="rounded border border-[var(--border-strong)] px-1.5 font-mono text-[10px] text-text-2">ปัจจุบัน</span>}
                    </div>
                    <div className="text-xs text-muted">{v.editedByName}</div>
                    <div className="text-xs text-faint">{fmt(v.createdAt)}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="min-w-0 flex-[999_1_480px] space-y-4" aria-label={`เวอร์ชัน ${selected}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                เวอร์ชัน {selected}
                {sel.prev ? <span className="text-sm font-normal text-muted"> เทียบกับ v{sel.prev.version}</span> : <span className="text-sm font-normal text-muted"> (เวอร์ชันแรก)</span>}
              </h2>
              <p className="text-xs text-muted">โดย {sel.editedByName} · {fmt(sel.createdAt)}</p>
            </div>
            {item.canEdit && !isCurrent && <RestoreButton itemId={id} version={selected} currentVersion={item.version} />}
          </div>
          <FieldChanges changes={changes} />
          <BodyDiff rows={rows} leftLabel={sel.prev ? `v${sel.prev.version} (ก่อนหน้า)` : "—"} rightLabel={`v${selected}`} />
        </section>
      </div>
    </div>
  );
}
