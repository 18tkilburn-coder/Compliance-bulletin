import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { ImpactBadge } from "@/components/impact-badge";
import { FavouriteButton } from "@/components/favourite-button";
import { ReviewedButton } from "@/components/reviewed-button";
import { ProgressBadge } from "@/components/progress-badge";
import { ChecklistItem } from "@/components/checklist-item";
import { topicLabel } from "@/lib/taxonomy";
import { requireUser } from "@/lib/dal";
import { parseCompletedIndices, tallyChecklist } from "@/lib/progress";

function formatDate(date: Date | null): string {
  if (!date) return "Unpublished";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function BulletinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const entry = await prisma.bulletinEntry.findUnique({ where: { id } });

  if (!entry || entry.status !== "PUBLISHED") {
    notFound();
  }

  const view = toBulletinView(entry);

  const [favourite, reviewed, progressRow] = await Promise.all([
    prisma.favouriteEntry.findUnique({
      where: { userId_entryId: { userId: user.id, entryId: id } },
    }),
    prisma.reviewedEntry.findUnique({
      where: { userId_entryId: { userId: user.id, entryId: id } },
    }),
    prisma.checklistProgress.findUnique({
      where: { userId_entryId: { userId: user.id, entryId: id } },
    }),
  ]);

  const completedIndices = parseCompletedIndices(progressRow?.completedItems);
  const progress = tallyChecklist(view.actionChecklist.length, completedIndices);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          &larr; Back to bulletin feed
        </Link>
        <Link
          href={`/print/${view.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
        >
          Export to PDF
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ImpactBadge level={view.impactLevel} />
          <span className="text-sm text-muted">
            {view.sourceName} &middot; Published {formatDate(view.publishedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ReviewedButton entryId={view.id} isReviewed={Boolean(reviewed)} />
          <FavouriteButton entryId={view.id} isFavourited={Boolean(favourite)} />
        </div>
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">{view.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.topics.map((slug) => (
          <span key={slug} className="rounded-full bg-background px-2.5 py-0.5 text-xs text-muted">
            {topicLabel(slug)}
          </span>
        ))}
        <ProgressBadge done={progress.done} total={progress.total} />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          What this means for you
        </h2>
        <p className="mt-2 text-base leading-relaxed text-foreground">{view.summary}</p>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Regulated activities affected
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {view.regulatedActivities.map((activity) => (
            <li key={activity} className="flex gap-2">
              <span className="text-accent">&#8226;</span>
              <span>{activity}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-accent/30 bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
            Do before your next inspection
          </h2>
          <ProgressBadge done={progress.done} total={progress.total} />
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {view.actionChecklist.map((item, i) => (
            <ChecklistItem
              key={i}
              entryId={view.id}
              index={i}
              label={item}
              checked={completedIndices.includes(i)}
            />
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-background p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Source</h2>
        <p className="mt-2 text-sm text-foreground">{view.rawText}</p>
        <a
          href={view.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          View original source &rarr;
        </a>
      </section>
    </div>
  );
}
