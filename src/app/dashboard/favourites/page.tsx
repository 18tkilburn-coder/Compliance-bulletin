import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { BulletinCard } from "@/components/bulletin-card";
import { requireUser } from "@/lib/dal";
import { getChecklistProgressMap } from "@/lib/user-entry-state";
import { tallyChecklist } from "@/lib/progress";

export default async function FavouritesPage() {
  const user = await requireUser();

  const [entries, progressMap] = await Promise.all([
    prisma.bulletinEntry.findMany({
      where: {
        status: "PUBLISHED",
        favouritedBy: { some: { userId: user.id } },
      },
      orderBy: { publishedAt: "desc" },
    }),
    getChecklistProgressMap(user.id),
  ]);

  const views = entries.map(toBulletinView);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Favourites</h1>
        <p className="mt-1 text-sm text-muted">
          Updates you&apos;ve pinned for quick reference — handy for inspection prep.
        </p>
      </div>

      <p className="mb-4 text-sm text-muted">
        {views.length} favourite{views.length === 1 ? "" : "s"}
      </p>

      {views.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No favourites yet. Tap the star on any bulletin entry to pin it here.
        </div>
      ) : (
        <div className="space-y-4">
          {views.map((entry) => (
            <BulletinCard
              key={entry.id}
              entry={entry}
              isFavourited
              progress={tallyChecklist(entry.actionChecklist.length, progressMap.get(entry.id) ?? [])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
