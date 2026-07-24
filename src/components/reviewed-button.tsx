import { toggleReviewedAction } from "@/app/dashboard/actions";

export function ReviewedButton({
  entryId,
  isReviewed,
}: {
  entryId: string;
  isReviewed: boolean;
}) {
  return (
    <form action={toggleReviewedAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        aria-pressed={isReviewed}
        aria-label={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
        title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
        className={`flex h-8 w-8 items-center justify-center rounded-md border text-base leading-none transition ${
          isReviewed
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface text-muted hover:border-accent/40 hover:text-accent"
        }`}
      >
        {isReviewed ? "✓" : "○"}
      </button>
    </form>
  );
}
