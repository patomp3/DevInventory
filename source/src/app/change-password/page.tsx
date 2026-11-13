import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSessionUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const { t } = await getT();
  return (
    <AuthCard title={t("auth.changeTitle")} subtitle={u.mustChangePassword ? t("auth.mustChange") : u.email}>
      <ChangePasswordForm />
    </AuthCard>
  );
}
