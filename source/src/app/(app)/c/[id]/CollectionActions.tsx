"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { api, PermissionDialog } from "@/components/PermissionDialog";
import { Alert, Button, Dialog, Field } from "@/components/ui";
import type { Effective, Setting } from "@/lib/permissions";

export function CollectionActions({ id, name, visibility, effective, hasParent }: { id: string; name: string; visibility: Setting; effective: Effective; hasParent: boolean }) {
  const router = useRouter();
  const t = useT();
  const [dlg, setDlg] = useState<"perm" | "rename" | "delete" | null>(null);
  const [val, setVal] = useState(name);
  const [err, setErr] = useState("");
  const close = () => { setDlg(null); setErr(""); };
  return (
    <>
      <Button variant="secondary" onClick={() => setDlg("perm")}>{t("vis.changePerm")}</Button>
      <Button variant="ghost" onClick={() => setDlg("rename")}>{t("coll.rename")}</Button>
      <Button variant="ghost" className="text-red-300" onClick={() => setDlg("delete")}>{t("common.delete")}</Button>

      {dlg === "perm" && (
        <PermissionDialog title={t("coll.permTitle")} current={visibility} effective={effective} canInherit={hasParent}
          widerWarning={t("coll.permWarn")}
          onClose={close}
          onSave={async (v) => {
            const r = await api(`/api/v1/collections/${id}`, "PATCH", { visibility: v });
            if (!r.ok) return r.error;
            close(); router.refresh();
          }} />
      )}
      {dlg === "rename" && (
        <Dialog title={t("coll.renameTitle")} onClose={close} width={460}>
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            const r = await api(`/api/v1/collections/${id}`, "PATCH", { name: val });
            if (!r.ok) return setErr(r.error!);
            close(); router.refresh();
          }}>
            {err && <Alert>{err}</Alert>}
            <Field label={t("common.name")} required maxLength={100} value={val} onChange={(e) => setVal(e.target.value)} />
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={close}>{t("common.cancel")}</Button><Button type="submit" disabled={!val.trim()}>{t("common.save")}</Button></div>
          </form>
        </Dialog>
      )}
      {dlg === "delete" && (
        <Dialog title={t("coll.deleteTitle")} onClose={close} width={460}>
          <div className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <p className="text-sm text-text-2">{t("coll.deleteBody", { name })}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>{t("common.cancel")}</Button>
              <Button variant="danger" onClick={async () => {
                const r = await api(`/api/v1/collections/${id}`, "DELETE");
                if (!r.ok) return setErr(r.error!);
                router.push("/"); router.refresh();
              }}>{t("common.delete")}</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
