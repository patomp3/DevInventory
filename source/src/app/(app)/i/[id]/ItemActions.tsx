"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { api, PermissionDialog } from "@/components/PermissionDialog";
import { CollectionPicker, type PickTarget } from "@/components/CollectionPicker";
import { Alert, Button, Dialog } from "@/components/ui";
import type { Effective, Setting } from "@/lib/permissions";

type Target = PickTarget;

export function ItemActions({ id, canEdit, canManage, visibility, effective, hasCollection, collectionId, targets }: {
  id: string; canEdit: boolean; canManage: boolean; visibility: Setting; effective: Effective; hasCollection: boolean; collectionId: string | null; targets: Target[];
}) {
  const router = useRouter();
  const t = useT();
  const [dlg, setDlg] = useState<"perm" | "move" | "delete" | null>(null);
  const [err, setErr] = useState("");
  const [dest, setDest] = useState<string>(collectionId ?? "");
  const close = () => { setDlg(null); setErr(""); };
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/i/${id}/history`} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-text-2 hover:bg-surface-hover">{t("item.history")}</Link>
      {canEdit && <Link href={`/i/${id}/edit`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-110">{t("item.edit")}</Link>}
      {canManage && (
        <>
          <Button variant="secondary" onClick={() => setDlg("perm")}>{t("vis.changePerm")}</Button>
          <Button variant="secondary" onClick={() => setDlg("move")}>{t("common.move")}</Button>
          <Button variant="ghost" className="text-red-300" onClick={() => setDlg("delete")}>{t("common.delete")}</Button>
        </>
      )}
      {dlg === "perm" && (
        <PermissionDialog title={t("item.permTitle")} current={visibility} effective={effective} canInherit={hasCollection}
          widerWarning={t("item.permWarn")}
          onClose={close}
          onSave={async (v) => {
            const r = await api(`/api/v1/items/${id}/visibility`, "PATCH", { visibility: v });
            if (!r.ok) return r.error;
            close(); router.refresh();
          }} />
      )}
      {dlg === "move" && (
        <Dialog title={t("move.title")} onClose={close} width={460}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <div className="space-y-1.5">
              <p className="text-[13px] font-semibold text-muted">{t("move.destination")}</p>
              <CollectionPicker targets={targets} value={dest} onChange={setDest} currentId={collectionId} />
              <p className="text-xs text-muted">{t("picker.hint")}</p>
            </div>
            <Alert tone="warn">{t("move.warn")}</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>{t("common.cancel")}</Button>
              <Button disabled={dest === (collectionId ?? "")} onClick={async () => {
                const r = await api(`/api/v1/items/${id}/move`, "PATCH", { collectionId: dest || null });
                if (!r.ok) return setErr(r.error!);
                close(); router.refresh();
              }}>{t("common.move")}</Button>
            </div>
          </div>
        </Dialog>
      )}
      {dlg === "delete" && (
        <Dialog title={t("item.deleteTitle")} onClose={close} width={460}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <p className="text-sm text-text-2">{t("item.deleteBody")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>{t("common.cancel")}</Button>
              <Button variant="danger" onClick={async () => {
                const r = await api(`/api/v1/items/${id}`, "DELETE");
                if (!r.ok) return setErr(r.error!);
                router.push(collectionId ? `/c/${collectionId}` : "/inbox"); router.refresh();
              }}>{t("common.delete")}</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
