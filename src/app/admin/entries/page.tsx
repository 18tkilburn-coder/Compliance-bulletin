import Link from "next/link";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { ImpactBadge } from "@/components/impact-badge";
import { togglePublishAction, deleteEntryAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    date
  );
}

export default async function AdminEntriesPage() {
  const entries = await prisma.bulletinEntry.findMany({ orderBy: { createdAt: "desc" } });
  const views = entries.map(toBulletinView);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All bulletin entries</h1>
          <p className="mt-1 text-sm text-muted">{views.length} entries total</p>
        </div>
        <Link
          href="/admin"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          + New bulletin entry
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Impact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {views.map((entry) => (
              <tr key={entry.id}>
                <td className="max-w-sm px-4 py-3">
                  <p className="font-medium text-foreground">{entry.title}</p>
                  <p className="text-xs text-muted">{entry.sourceName}</p>
                </td>
                <td className="px-4 py-3">
                  <ImpactBadge level={entry.impactLevel} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      entry.status === "PUBLISHED"
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-border bg-background text-muted"
                    }`}
                  >
                    {entry.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(entry.publishedAt ?? entry.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/entries/${entry.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    <form action={togglePublishAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button type="submit" className="text-xs font-medium text-muted hover:text-foreground">
                        {entry.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={deleteEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Delete "${entry.title}"? This cannot be undone.`}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {views.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            No bulletin entries yet. Create your first one.
          </p>
        )}
      </div>
    </div>
  );
}
