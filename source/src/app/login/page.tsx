import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSessionUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const u = await getSessionUser();
  const { t } = await getT();
  if (u) redirect(u.mustChangePassword ? "/change-password" : "/");
  return (
    <AuthCard title={t("login.title")} subtitle="Dev Inventory">
      <LoginForm />
      <div className="space-y-1 text-xs text-muted">
        <p>{t("login.forgot")}</p>
        <p>{t("login.noAccount")}</p>
      </div>
    </AuthCard>
  );
}
