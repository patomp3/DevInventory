"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CollectionTree } from "@/components/CollectionTree";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useT } from "@/components/LocaleProvider";
import { SearchButton } from "@/components/CommandPalette";
import { NewCollectionButton } from "@/components/CollectionDialog";
import type { TreeNode } from "@/lib/collections";

type U = { id: string; displayName: string; email: string; role: "admin" | "member" };

export function AppShell({ user, tree, children }: { user: U; tree: TreeNode[]; children: React.ReactNode }) {
  const path = usePathname();
  const t = useT();
  const item = (href: string, label: string, sub = false) => {
    const active = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={`flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm ${active ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"}`}>
        {sub && <span aria-hidden className="mr-2 text-muted">›</span>}
        {label}
      </Link>
    );
  };
  async function logout() {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    window.location.href = "/login";
  }
  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="flex-[0_0_264px] border-r border-[var(--border-nav)] bg-sidebar p-4">
        <div className="mb-5 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-mono text-xs font-semibold text-on-accent">DI</div>
          <span className="font-semibold">Dev Inventory</span>
        </div>
        <nav className="space-y-0.5" aria-label={t("nav.main")}>
          {item("/", t("nav.home"))}
          {item("/mine", t("nav.mine"))}
          {item("/inbox", t("nav.inbox"))}
        </nav>
        <div className="mb-1 mt-4 flex items-center justify-between px-3">
          <p className="text-[13px] font-semibold text-muted">{t("nav.collections")}</p>
          <NewCollectionButton />
        </div>
        <CollectionTree nodes={tree} />
        <nav className="mt-4 space-y-0.5 border-t border-[var(--border-nav)] pt-3" aria-label={t("nav.other")}>
          {item("/search", t("nav.search"))}
          {item("/trash", t("nav.trash"))}
          {user.role === "admin" && (
            <div className="mt-4 border-t border-[var(--border-nav)] pt-3">
              <p className="cursor-default select-none px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
                {t("nav.admin")}
              </p>
              <div className="ml-3 space-y-0.5 border-l border-[var(--border-strong)] pl-1">
                {item("/admin/users", t("nav.admin.users"), true)}
                {item("/admin/private-items", t("nav.admin.privateItems"), true)}
                {item("/admin/audit", t("nav.admin.audit"), true)}
                {item("/admin/settings", t("nav.admin.settings"), true)}
              </div>
            </div>
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-[999_1_560px]">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border-nav)] px-8 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110">{t("header.new")}</Link>
            <SearchButton userKey={user.id} />
          </div>
          {/* มุมขวา 2×2: บน = ชื่อผู้ใช้ + ออกจากระบบ · ล่าง = เปลี่ยนรหัสผ่าน + ธงสลับภาษา (อยู่ใต้ปุ่มออกจากระบบ) */}
          <div className="ml-auto grid grid-cols-[auto_auto] items-center justify-items-end gap-x-3 gap-y-1">
            <div className="text-right text-xs leading-tight">
              <div className="text-text-2">{user.displayName}</div>
              <div className="text-muted">{user.email}</div>
            </div>
            <button onClick={logout} className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs text-text-2 hover:bg-surface-hover">{t("header.logout")}</button>
            <Link href="/change-password" className="text-xs text-muted hover:text-text">{t("header.changePassword")}</Link>
            <div className="flex items-start gap-2"><ThemeSwitcher /><LanguageSwitcher /></div>
          </div>
        </header>
        <main className="px-8 pb-10 pt-7">{children}</main>
      </div>
    </div>
  );
}
