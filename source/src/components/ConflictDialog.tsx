"use client";
import { useMemo, useState } from "react";
import { BodyDiff, FieldChanges } from "@/components/DiffView";
import { useLocale, useT } from "@/components/LocaleProvider";
import { DATE_LOCALE } from "@/lib/i18n/locales";
import { Button, Dialog } from "@/components/ui";
import type { Kind } from "@/lib/item-content";
import { changedFields, sideBySide, type SnapshotView } from "@/lib/item-history";

/** สถานะล่าสุดที่ server ส่งมากับ 409 (items.ts → updateItem) */
export type ConflictCurrent = SnapshotView & { version: number; editedBy: string | null; editedAt: string | null };

/** ข้อความของฉันสำหรับ "คัดลอกเก็บไว้" — ชื่อ + คำอธิบาย + เนื้อหา Markdown */
export function mineAsText(m: SnapshotView): string {
  return [`# ${m.title}`, m.summary ?? "", m.body ?? "", m.tags.length ? `Tag: ${m.tags.join(", ")}` : ""].filter(Boolean).join("\n\n");
}

/**
 * Dialog บันทึกชนกัน (HTTP 409, design.md §10.2, ui-design §1.1)
 * 3 ทาง: (1) ใช้ของล่าสุดแล้วแก้ใหม่ (2) บันทึกทับ — เวอร์ชันของอีกคนยังอยู่ในประวัติ (3) คัดลอกของฉันเก็บไว้ก่อน
 */
export function ConflictDialog({ current, mine, onUseLatest, onOverwrite, onClose }: {
  current: ConflictCurrent; mine: SnapshotView; onUseLatest: () => void; onOverwrite: () => void; onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const theirs: SnapshotView = { title: current.title, summary: current.summary, body: current.body, kinds: current.kinds as Kind[], tags: current.tags };
  const rows = useMemo(() => sideBySide(theirs.body, mine.body), [theirs.body, mine.body]);
  const changes = useMemo(() => changedFields(theirs, mine), [theirs, mine]);
  const diffRows = rows.filter((r) => r.left?.kind !== "same" || r.right?.kind !== "same"); // แสดงเฉพาะบรรทัดที่ต่างกัน (diff ย่อ)
  const shown = diffRows.slice(0, 40);
  const when = current.editedAt ? new Date(current.editedAt).toLocaleString(DATE_LOCALE[locale], { dateStyle: "medium", timeStyle: "short" }) : null;

  async function copyMine() {
    await navigator.clipboard.writeText(mineAsText(mine));
    setCopied(true);
  }

  return (
    <Dialog title={t("conflict.title")} onClose={onClose} width={720}>
      <div className="space-y-4">
        <p className="text-sm text-text-2">
          {t("conflict.saved", { v: current.version })}{current.editedBy ? <> {t("conflict.by")} <b>{current.editedBy}</b></> : null}{when ? ` ${t("conflict.at", { when })}` : ""}
          {" "}{t("conflict.while")}
        </p>
        <FieldChanges changes={changes} />
        {shown.length > 0 ? (
          <div className="max-h-72 overflow-y-auto rounded-xl">
            <BodyDiff rows={shown} leftLabel={t("conflict.latestLabel", { v: current.version })} rightLabel={t("conflict.yours")} />
            {diffRows.length > shown.length && <p className="mt-1 text-xs text-muted">{t("conflict.showing", { shown: shown.length, total: diffRows.length })}</p>}
          </div>
        ) : changes.length === 0 ? (
          <p className="text-sm text-muted">{t("conflict.identical")}</p>
        ) : null}
        <ul className="space-y-1 text-xs text-muted">
          <li><b className="text-text-2">{t("conflict.useLatest")}</b> — {t("conflict.useLatestHelp", { v: current.version })}</li>
          <li><b className="text-text-2">{t("conflict.overwrite")}</b> — {t("conflict.overwriteHelp")}</li>
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={copyMine} aria-live="polite">{copied ? t("conflict.copiedMine") : t("conflict.copyMine")}</Button>
          <Button type="button" variant="secondary" onClick={onUseLatest}>{t("conflict.useLatest")}</Button>
          <Button type="button" variant="danger" onClick={onOverwrite}>{t("conflict.overwrite")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
