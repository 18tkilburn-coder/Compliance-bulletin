import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white text-sm font-semibold">
        CI
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-foreground">Compliance Bulletin</span>
        <span className="text-[11px] text-muted -mt-0.5">Regulatory intelligence for care homes</span>
      </span>
    </Link>
  );
}
