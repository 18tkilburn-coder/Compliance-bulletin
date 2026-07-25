import { toggleFavouriteAction } from "@/app/dashboard/actions";

export function FavouriteButton({
  entryId,
  isFavourited,
}: {
  entryId: string;
  isFavourited: boolean;
}) {
  return (
    <form action={toggleFavouriteAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        aria-pressed={isFavourited}
        aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
        title={isFavourited ? "Remove from favourites" : "Add to favourites"}
        className={`flex h-8 w-8 items-center justify-center rounded-md border text-base leading-none transition ${
          isFavourited
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface text-muted hover:border-accent/40 hover:text-accent"
        }`}
      >
        {isFavourited ? "★" : "☆"}
      </button>
    </form>
  );
}
