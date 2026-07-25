import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { toBulletinView } from "@/lib/bulletin-view";
import { updateEntryAction } from "@/app/admin/actions";
import { IMPACT_LEVELS } from "@/lib/types";
import { TOPICS, REGULATED_ACTIVITIES } from "@/lib/taxonomy";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await prisma.bulletinEntry.findUnique({ where: { id } });
  if (!entry) notFound();

  const view = toBulletinView(entry);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/entries" className="text-sm text-muted hover:text-foreground">
        &larr; Back to all entries
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Edit bulletin entry</h1>
      <p className="mt-1 text-sm text-muted">
        Status: <span className="font-medium text-foreground">{view.status}</span> — use
        the publish toggle from the entries list to change this.
      </p>

      <form action={updateEntryAction} className="mt-6 space-y-6 rounded-xl border border-border bg-surface p-6">
        <input type="hidden" name="id" value={view.id} />

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={view.title}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="sourceName" className="block text-sm font-medium text-foreground">
              Source
            </label>
            <input
              id="sourceName"
              name="sourceName"
              required
              defaultValue={view.sourceName}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-foreground">
              Source URL
            </label>
            <input
              id="sourceUrl"
              name="sourceUrl"
              type="url"
              required
              defaultValue={view.sourceUrl}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="rawText" className="block text-sm font-medium text-foreground">
            Raw update text
          </label>
          <textarea
            id="rawText"
            name="rawText"
            required
            rows={6}
            defaultValue={view.rawText}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="summary" className="block text-sm font-medium text-foreground">
            Plain-English summary
          </label>
          <textarea
            id="summary"
            name="summary"
            required
            rows={4}
            defaultValue={view.summary}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-foreground">Impact score</span>
          <div className="mt-2 flex gap-3">
            {IMPACT_LEVELS.map((level) => (
              <label
                key={level}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="impactLevel"
                  value={level}
                  defaultChecked={view.impactLevel === level}
                />
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-foreground">Topics</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <label
                key={topic.slug}
                className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  name="topics"
                  value={topic.slug}
                  defaultChecked={view.topics.includes(topic.slug)}
                />
                {topic.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-foreground">
            Regulated activities affected
          </span>
          <div className="mt-2 space-y-2">
            {REGULATED_ACTIVITIES.map((activity) => (
              <label key={activity} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="regulatedActivities"
                  value={activity}
                  defaultChecked={view.regulatedActivities.includes(activity)}
                />
                {activity}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="actionChecklist" className="block text-sm font-medium text-foreground">
            Action checklist (one item per line)
          </label>
          <textarea
            id="actionChecklist"
            name="actionChecklist"
            required
            rows={6}
            defaultValue={view.actionChecklist.join("\n")}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
