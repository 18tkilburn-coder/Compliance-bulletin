import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { ImpactBadge } from "@/components/impact-badge";
import { topicLabel } from "@/lib/taxonomy";

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
  const entry = await prisma.bulletinEntry.findUnique({ where: { id } });

  if (!entry || entry.status !== "PUBLISHED") {
    notFound();
  }

  const view = toBulletinView(entry);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        &larr; Back to bulletin feed
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ImpactBadge level={view.impactLevel} />
        <span className="text-sm text-muted">
          {view.sourceName} &middot; Published {formatDate(view.publishedAt)}
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">{view.title}</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        {view.topics.map((slug) => (
          <span key={slug} className="rounded-full bg-background px-2.5 py-0.5 text-xs text-muted">
            {topicLabel(slug)}
          </span>
        ))}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          Do before your next inspection
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {view.actionChecklist.map((item, i) => (
            <li key={i} className="flex gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[color:var(--accent)]"
              />
              <span>{item}</span>
            </li>
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
