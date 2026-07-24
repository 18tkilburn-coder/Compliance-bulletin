export function ProgressBadge({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;

  const pct = Math.round((done / total) * 100);
  const complete = done === total;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted">
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-border">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${complete ? "bg-accent" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={complete ? "font-medium text-accent" : undefined}>
        {done} of {total} done
      </span>
    </span>
  );
}
