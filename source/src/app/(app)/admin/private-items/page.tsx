import { notFound } from "next/navigation";
import { PrivateItemsClient } from "./PrivateItemsClient";
import { listPrivateItems, listTransferCandidates } from "@/lib/admin-items";
import { getSessionUser, toCtx } from "@/lib/auth/session";

export default async function AdminPrivateItemsPage() {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") notFound();
  const ctx = toCtx(me);
  const [rows, candidates] = await Promise.all([listPrivateItems(ctx), listTransferCandidates(ctx)]);
  return <PrivateItemsClient candidates={candidates} rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} />;
}
