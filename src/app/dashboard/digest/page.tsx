import Link from "next/link";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { buildDigestHtml } from "@/lib/email-digest";
import { requireUser } from "@/lib/dal";
import { daysAgo } from "@/lib/date";

const RANGES: { value: string; label: string; days: number | null }[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "all", label: "All published", days: null },
];

export default async function DigestPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range } = await searchParams;
  const selectedRange = RANGES.find((r) => r.value === range) ?? RANGES[0];

  const since = selectedRange.days ? daysAgo(selectedRange.days) : null;

  const entries = await prisma.bulletinEntry.findMany({
    where: {
      status: "PUBLISHED",
      ...(since ? { publishedAt: { gte: since } } : {}),
    },
    orderBy: { publishedAt: "desc" },
  });

  const views = entries.map(toBulletinView);
  const careHomeName = user.subscription?.careHomeName ?? user.name;

  const html = buildDigestHtml(views, {
    careHomeName,
    periodLabel: selectedRange.label,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Email digest preview</h1>
        <p className="mt-1 text-sm text-muted">
          This shows the HTML email your team would receive. Preview only for this MVP —
          nothing is sent.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/dashboard/digest?range=${r.value}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedRange.value === r.value
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Rendered preview
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <iframe
              title="Email digest preview"
              srcDoc={html}
              className="h-[720px] w-full bg-background"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            HTML source (copy into your email tool)
          </p>
          <textarea
            readOnly
            value={html}
            className="h-[720px] w-full resize-none rounded-lg border border-border bg-surface p-4 font-mono text-xs text-foreground outline-none"
          />
        </div>
      </div>
    </div>
  );
}
