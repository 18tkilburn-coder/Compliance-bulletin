import Link from "next/link";
import type { BulletinView } from "@/lib/bulletin-view";
import { ImpactBadge } from "./impact-badge";
import { FavouriteButton } from "./favourite-button";
import { ProgressBadge } from "./progress-badge";
import { topicLabel } from "@/lib/taxonomy";
import type { ChecklistTally } from "@/lib/progress";

function formatDate(date: Date | null): string {
  if (!date) return "Unpublished";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    date
  );
}

export function BulletinCard({
  entry,
  isFavourited,
  progress,
}: {
  entry: BulletinView;
  isFavourited: boolean;
  progress: ChecklistTally;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-sm">
      <Link
        href={`/dashboard/${entry.id}`}
        className="absolute inset-0 rounded-lg"
        aria-label={entry.title}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ImpactBadge level={entry.impactLevel} />
          <span className="text-xs text-muted">
            {entry.sourceName} &middot; {formatDate(entry.publishedAt)}
          </span>
        </div>
        <div className="relative z-10">
          <FavouriteButton entryId={entry.id} isFavourited={isFavourited} />
        </div>
      </div>

      <h2 className="mt-3 font-semibold text-foreground">{entry.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{entry.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {entry.topics.map((slug) => (
          <span key={slug} className="rounded-full bg-background px-2.5 py-0.5 text-xs text-muted">
            {topicLabel(slug)}
          </span>
        ))}
        <ProgressBadge done={progress.done} total={progress.total} />
      </div>
    </div>
  );
}
