import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[420px] space-y-5 rounded-xl border border-line bg-sidebar p-7">
        <div className="flex items-start justify-end gap-2"><ThemeSwitcher /><LanguageSwitcher /></div>
        <div>
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-mono text-sm font-semibold text-on-accent">DI</div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
