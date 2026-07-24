import Link from "next/link";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { BulletinCard } from "@/components/bulletin-card";
import { IMPACT_LEVELS, type ImpactLevel } from "@/lib/types";
import { TOPICS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/dal";
import { getFavouriteEntryIds, getChecklistProgressMap } from "@/lib/user-entry-state";
import { tallyChecklist } from "@/lib/progress";

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
  const user = await requireUser();
  const { impact, topic } = await searchParams;
  const activeImpact = IMPACT_LEVELS.includes(impact as ImpactLevel) ? (impact as ImpactLevel) : undefined;
  const activeTopic = TOPICS.some((t) => t.slug === topic) ? topic : undefined;

  const [entries, favouriteIds, progressMap] = await Promise.all([
    prisma.bulletinEntry.findMany({
      where: {
        status: "PUBLISHED",
        ...(activeImpact ? { impactLevel: activeImpact } : {}),
      },
      orderBy: { publishedAt: "desc" },
    }),
    getFavouriteEntryIds(user.id),
    getChecklistProgressMap(user.id),
  ]);

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
            <BulletinCard
              key={entry.id}
              entry={entry}
              isFavourited={favouriteIds.has(entry.id)}
              progress={tallyChecklist(entry.actionChecklist.length, progressMap.get(entry.id) ?? [])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
