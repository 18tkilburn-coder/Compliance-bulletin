import Link from "next/link";
import { Logo } from "./logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <div className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Logo />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
      <div className="px-6 pb-8 text-center text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          &larr; Back to homepage
        </Link>
      </div>
    </div>
  );
}
