import { notFound } from "next/navigation";
import { SettingsClient } from "./SettingsClient";
import { getSessionUser, toCtx } from "@/lib/auth/session";
import { getSettings, SYSTEM_LIMITS } from "@/lib/workspace-settings";

export default async function AdminSettingsPage() {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") notFound();
  return <SettingsClient initial={await getSettings(toCtx(me))} limits={SYSTEM_LIMITS} />;
}
