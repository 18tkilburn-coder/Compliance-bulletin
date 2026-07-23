import Link from "next/link";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { ImpactBadge } from "@/components/impact-badge";
import { IMPACT_LEVELS, type ImpactLevel } from "@/lib/types";
import { TOPICS, topicLabel } from "@/lib/taxonomy";

function formatDate(date: Date | null): string {
  if (!date) return "Unpublished";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    date
  );
}

function buildHref(params: { impact?: string; topic?: string }) {
  const search = new URLSearchParams();
  if (params.impact) search.set("impact", params.impact);
  if (params.topic) search.set("topic", params.topic);
  const query = search.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

export default async function DashboardFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string; topic?: string }>;
}) {
  const { impact, topic } = await searchParams;
  const activeImpact = IMPACT_LEVELS.includes(impact as ImpactLevel) ? (impact as ImpactLevel) : undefined;
  const activeTopic = TOPICS.some((t) => t.slug === topic) ? topic : undefined;

  const entries = await prisma.bulletinEntry.findMany({
    where: {
      status: "PUBLISHED",
      ...(activeImpact ? { impactLevel: activeImpact } : {}),
    },
    orderBy: { publishedAt: "desc" },
  });

  const views = entries
    .map(toBulletinView)
    .filter((entry) => !activeTopic || entry.topics.includes(activeTopic));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Bulletin feed</h1>
        <p className="mt-1 text-sm text-muted">
          Chronological updates, scored by impact and translated into action points.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Impact</span>
          <Link
            href={buildHref({ topic: activeTopic })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !activeImpact
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            All
          </Link>
          {IMPACT_LEVELS.map((level) => (
            <Link
              key={level}
              href={buildHref({ impact: level, topic: activeTopic })}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                activeImpact === level
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              {level.charAt(0) + level.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Topic</span>
          <Link
            href={buildHref({ impact: activeImpact })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !activeTopic
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            All
          </Link>
          {TOPICS.map((t) => (
            <Link
              key={t.slug}
              href={buildHref({ impact: activeImpact, topic: t.slug })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activeTopic === t.slug
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        {views.length} update{views.length === 1 ? "" : "s"}
      </p>

      {views.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No updates match these filters yet.
        </div>
      ) : (
        <div className="space-y-4">
          {views.map((entry) => (
            <Link
              key={entry.id}
              href={`/dashboard/${entry.id}`}
              className="block rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <ImpactBadge level={entry.impactLevel} />
                  <span className="text-xs text-muted">
                    {entry.sourceName} &middot; {formatDate(entry.publishedAt)}
                  </span>
                </div>
              </div>
              <h2 className="mt-3 font-semibold text-foreground">{entry.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{entry.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.topics.map((slug) => (
                  <span
                    key={slug}
                    className="rounded-full bg-background px-2.5 py-0.5 text-xs text-muted"
                  >
                    {topicLabel(slug)}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
