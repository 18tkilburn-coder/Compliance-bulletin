import Link from "next/link";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { BulletinCard } from "@/components/bulletin-card";
import { IMPACT_LEVELS, type ImpactLevel } from "@/lib/types";
import { TOPICS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/dal";
import { getFavouriteEntryIds, getChecklistProgressMap, getReviewedEntryIds } from "@/lib/user-entry-state";
import { tallyChecklist } from "@/lib/progress";

interface FeedFilters {
  impact?: string;
  topic?: string;
  q?: string;
  unreviewed?: boolean;
}

function buildHref(params: FeedFilters) {
  const search = new URLSearchParams();
  if (params.impact) search.set("impact", params.impact);
  if (params.topic) search.set("topic", params.topic);
  if (params.q) search.set("q", params.q);
  if (params.unreviewed) search.set("unreviewed", "1");
  const query = search.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function filterPillClass(active: boolean) {
  return `rounded-full border px-3 py-1 text-xs font-medium ${
    active
      ? "border-primary bg-primary text-white"
      : "border-border bg-surface text-muted hover:text-foreground"
  }`;
}

export default async function DashboardFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string; topic?: string; q?: string; unreviewed?: string }>;
}) {
  const user = await requireUser();
  const { impact, topic, q, unreviewed } = await searchParams;
  const activeImpact = IMPACT_LEVELS.includes(impact as ImpactLevel) ? (impact as ImpactLevel) : undefined;
  const activeTopic = TOPICS.some((t) => t.slug === topic) ? topic : undefined;
  const activeQuery = (q ?? "").trim();
  const showUnreviewedOnly = unreviewed === "1";

  const [entries, favouriteIds, progressMap, reviewedIds] = await Promise.all([
    prisma.bulletinEntry.findMany({
      where: {
        status: "PUBLISHED",
        ...(activeImpact ? { impactLevel: activeImpact } : {}),
      },
      orderBy: { publishedAt: "desc" },
    }),
    getFavouriteEntryIds(user.id),
    getChecklistProgressMap(user.id),
    getReviewedEntryIds(user.id),
  ]);

  const lowerQuery = activeQuery.toLowerCase();

  const views = entries
    .map(toBulletinView)
    .filter((entry) => !activeTopic || entry.topics.includes(activeTopic))
    .filter(
      (entry) =>
        !lowerQuery ||
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.summary.toLowerCase().includes(lowerQuery)
    )
    .filter((entry) => !showUnreviewedOnly || !reviewedIds.has(entry.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Bulletin feed</h1>
        <p className="mt-1 text-sm text-muted">
          Chronological updates, scored by impact and translated into action points.
        </p>
      </div>

      <form action="/dashboard" className="mb-6 flex flex-wrap items-center gap-2">
        {activeImpact && <input type="hidden" name="impact" value={activeImpact} />}
        {activeTopic && <input type="hidden" name="topic" value={activeTopic} />}
        {showUnreviewedOnly && <input type="hidden" name="unreviewed" value="1" />}
        <input
          type="search"
          name="q"
          defaultValue={activeQuery}
          placeholder="Search titles and summaries…"
          className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-background"
        >
          Search
        </button>
        {activeQuery && (
          <Link
            href={buildHref({ impact: activeImpact, topic: activeTopic, unreviewed: showUnreviewedOnly })}
            className="text-sm text-muted hover:text-foreground"
          >
            Clear search
          </Link>
        )}
      </form>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Impact</span>
          <Link
            href={buildHref({ topic: activeTopic, q: activeQuery, unreviewed: showUnreviewedOnly })}
            className={filterPillClass(!activeImpact)}
          >
            All
          </Link>
          {IMPACT_LEVELS.map((level) => (
            <Link
              key={level}
              href={buildHref({
                impact: level,
                topic: activeTopic,
                q: activeQuery,
                unreviewed: showUnreviewedOnly,
              })}
              className={`${filterPillClass(activeImpact === level)} capitalize`}
            >
              {level.charAt(0) + level.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Topic</span>
          <Link
            href={buildHref({ impact: activeImpact, q: activeQuery, unreviewed: showUnreviewedOnly })}
            className={filterPillClass(!activeTopic)}
          >
            All
          </Link>
          {TOPICS.map((t) => (
            <Link
              key={t.slug}
              href={buildHref({
                impact: activeImpact,
                topic: t.slug,
                q: activeQuery,
                unreviewed: showUnreviewedOnly,
              })}
              className={filterPillClass(activeTopic === t.slug)}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
          <Link
            href={buildHref({ impact: activeImpact, topic: activeTopic, q: activeQuery })}
            className={filterPillClass(!showUnreviewedOnly)}
          >
            All updates
          </Link>
          <Link
            href={buildHref({ impact: activeImpact, topic: activeTopic, q: activeQuery, unreviewed: true })}
            className={filterPillClass(showUnreviewedOnly)}
          >
            Unreviewed only
          </Link>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        {views.length} update{views.length === 1 ? "" : "s"}
        {activeQuery && <> matching &ldquo;{activeQuery}&rdquo;</>}
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
              isReviewed={reviewedIds.has(entry.id)}
              progress={tallyChecklist(entry.actionChecklist.length, progressMap.get(entry.id) ?? [])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
