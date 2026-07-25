import { requireAdmin } from "@/lib/dal";
import { AppShell, type AppNavItem } from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  const navItems: AppNavItem[] = [
    { href: "/admin", label: "New bulletin" },
    { href: "/admin/entries", label: "All entries" },
    { href: "/dashboard", label: "Customer view" },
  ];

  return (
    <AppShell navItems={navItems} identityLabel={user.name} identitySubLabel="Content admin">
      {children}
    </AppShell>
  );
}
