export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Compliance Bulletin. Not affiliated with the Care Quality Commission.</p>
          <p>Built for registered managers and providers across England.</p>
        </div>
      </div>
    </footer>
  );
}
