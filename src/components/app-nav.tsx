"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppNavItem } from "./app-shell";

export function AppNav({ navItems }: { navItems: AppNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-6xl gap-1 px-6">
      {navItems.map((item) => {
        const isActive =
          item.href === pathname || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`border-b-2 px-3 py-3 text-sm font-medium ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
