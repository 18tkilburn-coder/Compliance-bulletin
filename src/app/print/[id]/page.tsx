import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { ImpactBadge } from "@/components/impact-badge";
import { PrintButton } from "@/components/print-button";
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

export default async function PrintEntryPage({
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

  const progressRow = await prisma.checklistProgress.findUnique({
    where: { userId_entryId: { userId: user.id, entryId: id } },
  });
  const completedIndices = parseCompletedIndices(progressRow?.completedItems);
  const progress = tallyChecklist(view.actionChecklist.length, completedIndices);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="print:hidden mb-8 flex items-center justify-between">
        <Link href={`/dashboard/${view.id}`} className="text-sm text-muted hover:text-foreground">
          &larr; Back to entry
        </Link>
        <PrintButton />
      </div>

      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
          <span className="text-sm font-semibold text-foreground">Regulation Radar</span>
        </div>
        <span className="text-xs text-muted">
          Inspection evidence record &middot; printed{" "}
          {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
            new Date()
          )}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <ImpactBadge level={view.impactLevel} />
        <span className="text-sm text-muted">
          {view.sourceName} &middot; Published {formatDate(view.publishedAt)}
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">{view.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.topics.map((slug) => (
          <span key={slug} className="rounded-full bg-background px-2.5 py-0.5 text-xs text-muted">
            {topicLabel(slug)}
          </span>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          What this means for you
        </h2>
        <p className="mt-2 text-base leading-relaxed text-foreground">{view.summary}</p>
      </section>

      <section className="mt-6">
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

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Do before your next inspection
          </h2>
          <span className="text-xs text-muted">
            {progress.done} of {progress.total} complete
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {view.actionChecklist.map((item, i) => {
            const checked = completedIndices.includes(i);
            return (
              <li key={i} className="flex gap-3">
                <input type="checkbox" checked={checked} disabled className="mt-0.5 h-4 w-4 shrink-0" />
                <span className={checked ? "text-muted line-through" : "text-foreground"}>{item}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 border-t border-border pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Source</h2>
        <p className="mt-2 text-sm text-foreground">{view.rawText}</p>
        <p className="mt-2 text-sm text-muted break-all">{view.sourceUrl}</p>
      </section>
    </div>
  );
}
