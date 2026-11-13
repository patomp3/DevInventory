"use client";
import { useT } from "@/components/LocaleProvider";
import { VIS_ICON, VIS_LABEL } from "@/lib/visibility-labels";
import type { Setting } from "@/lib/permissions";

export function VisibilityBadge({ value }: { value: Setting }) {
  const t = useT();
  return <span className="inline-flex items-center gap-1 text-xs text-muted" title={t(VIS_LABEL[value])}><span aria-hidden>{VIS_ICON[value]}</span>{t(VIS_LABEL[value])}</span>;
}
