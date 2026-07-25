import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0" priority />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-foreground">Regulation Radar</span>
        <span className="text-[11px] text-muted -mt-0.5">Regulatory intelligence for care homes</span>
      </span>
    </Link>
  );
}
