import { Logo } from "./logo";
import { AppNav } from "./app-nav";
import { logout } from "@/app/actions/auth";

export interface AppNavItem {
  href: string;
  label: string;
}

export function AppShell({
  navItems,
  identityLabel,
  identitySubLabel,
  children,
}: {
  navItems: AppNavItem[];
  identityLabel: string;
  identitySubLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">{identityLabel}</p>
              <p className="text-xs text-muted">{identitySubLabel}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
        <AppNav navItems={navItems} />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
