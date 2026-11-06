"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CollectionTree } from "@/components/CollectionTree";
import { SearchButton } from "@/components/CommandPalette";
import { NewCollectionButton } from "@/components/CollectionDialog";
import type { TreeNode } from "@/lib/collections";

type U = { id: string; displayName: string; email: string; role: "admin" | "member" };

export function AppShell({ user, tree, children }: { user: U; tree: TreeNode[]; children: React.ReactNode }) {
  const path = usePathname();
  const item = (href: string, label: string) => {
    const active = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center rounded-lg px-3 text-sm ${active ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"}`}>
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
        <nav className="space-y-0.5" aria-label="เมนูหลัก">
          {item("/", "หน้าแรก")}
          {item("/inbox", "Inbox")}
          {item("/mine", "ของฉัน")}
          {item("/search", "ค้นหา")}
          {item("/trash", "ถังขยะ")}
          {user.role === "admin" && (
            <>
              <p className="px-3 pb-1 pt-4 text-[13px] font-semibold text-muted">ผู้ดูแลระบบ</p>
              {item("/admin/users", "ผู้ใช้")}
              {item("/admin/private-items", "รายการส่วนตัว")}
              {item("/admin/audit", "Audit log")}
              {item("/admin/settings", "ตั้งค่า")}
            </>
          )}
        </nav>
        <div className="mb-1 mt-5 flex items-center justify-between px-3">
          <p className="text-[13px] font-semibold text-muted">Collections</p>
          <NewCollectionButton />
        </div>
        <CollectionTree nodes={tree} />
      </aside>
      <div className="min-w-0 flex-[999_1_560px]">
        <header className="flex items-center justify-end gap-3 border-b border-[var(--border-nav)] px-8 py-3">
          <div className="text-right text-xs leading-tight">
            <div className="text-text-2">{user.displayName}</div>
            <div className="text-muted">{user.email}</div>
          </div>
          <div className="mr-auto flex flex-wrap items-center gap-3">
            <Link href="/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110">+ สร้างใหม่</Link>
            <SearchButton userKey={user.id} />
          </div>
          <Link href="/change-password" className="rounded-lg px-3 py-2 text-xs text-muted hover:bg-surface-hover">เปลี่ยนรหัสผ่าน</Link>
          <button onClick={logout} className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs text-text-2 hover:bg-surface-hover">ออกจากระบบ</button>
        </header>
        <main className="px-8 pb-10 pt-7">{children}</main>
      </div>
    </div>
  );
}
