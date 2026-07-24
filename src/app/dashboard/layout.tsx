import { requireUser } from "@/lib/dal";
import { AppShell, type AppNavItem } from "@/components/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const navItems: AppNavItem[] = [
    { href: "/dashboard", label: "Bulletin feed" },
    { href: "/dashboard/favourites", label: "Favourites" },
    { href: "/dashboard/digest", label: "Email digest" },
    { href: "/dashboard/account", label: "Account" },
  ];

  if (user.role === "ADMIN") {
    navItems.push({ href: "/admin", label: "Admin" });
  }

  return (
    <AppShell
      navItems={navItems}
      identityLabel={user.subscription?.careHomeName ?? user.name}
      identitySubLabel={user.email}
    >
      {children}
    </AppShell>
  );
}
