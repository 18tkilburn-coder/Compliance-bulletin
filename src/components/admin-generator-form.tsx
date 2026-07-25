"use client";

import { useActionState } from "react";
import {
  generateDraftAction,
  saveDraftAction,
  publishAction,
  type GenerateDraftState,
} from "@/app/admin/actions";
import { IMPACT_LEVELS } from "@/lib/types";
import { TOPICS, REGULATED_ACTIVITIES } from "@/lib/taxonomy";

const initialState: GenerateDraftState = {};

export function AdminGeneratorForm() {
  const [state, action, pending] = useActionState(generateDraftAction, initialState);

  if (!state?.draft || !state.raw) {
    return (
      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="e.g. CQC updates guidance on safeguarding notifications"
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
              placeholder="CQC, Skills for Care, UKHSA..."
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
              placeholder="https://www.cqc.org.uk/..."
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
            rows={10}
            placeholder="Paste the guidance text, notice or announcement here..."
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Generating..." : "Generate structured entry"}
        </button>
      </form>
    );
  }

  const { raw, draft } = state;

  return (
    <form className="space-y-6">
      <input type="hidden" name="title" value={raw.title} />
      <input type="hidden" name="sourceName" value={raw.sourceName} />
      <input type="hidden" name="sourceUrl" value={raw.sourceUrl} />
      <input type="hidden" name="rawText" value={raw.rawText} />

      <div className="rounded-md border border-border bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Generated from
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{raw.title}</p>
        <p className="text-xs text-muted">
          {raw.sourceName} &middot; {raw.sourceUrl}
        </p>
        <a href="/admin" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
          Start over with a different update
        </a>
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
          defaultValue={draft.summary}
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
                defaultChecked={draft.impactLevel === level}
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
                defaultChecked={draft.topics.includes(topic.slug)}
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
                defaultChecked={draft.regulatedActivities.includes(activity)}
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
          defaultValue={draft.actionChecklist.join("\n")}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          formAction={saveDraftAction}
          className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-background"
        >
          Save as draft
        </button>
        <button
          type="submit"
          formAction={publishAction}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Publish to customers
        </button>
      </div>
    </form>
  );
}
