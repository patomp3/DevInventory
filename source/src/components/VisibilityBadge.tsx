import { VIS_ICON, VIS_LABEL } from "@/lib/visibility-labels";
import type { Setting } from "@/lib/permissions";

export function VisibilityBadge({ value }: { value: Setting }) {
  return <span className="inline-flex items-center gap-1 text-xs text-muted" title={VIS_LABEL[value]}><span aria-hidden>{VIS_ICON[value]}</span>{VIS_LABEL[value]}</span>;
}
