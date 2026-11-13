import { AuthCard } from "@/components/AuthCard";
import { lookupInvite } from "@/lib/invites";
import { getT } from "@/lib/i18n/server";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await lookupInvite(token);
  const { t } = await getT();
  if (!inv) {
    return (
      <AuthCard title={t("auth.invalidInviteTitle")}>
        <p className="text-sm text-muted">{t("auth.invalidInvite")}</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("auth.setPwTitle")} subtitle={t("auth.inviteSub", { ws: inv.workspaceName, role: inv.role === "admin" ? "Admin" : "Member" })}>
      <SetPasswordForm token={token} email={inv.email} />
    </AuthCard>
  );
}
