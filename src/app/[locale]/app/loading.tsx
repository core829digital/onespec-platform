export default function AppLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse" aria-busy="true" aria-label="Caricamento">
      <div className="border-b border-[var(--color-border)] pb-4">
        <div className="h-7 w-56 rounded-lg bg-[var(--color-bg-alt)]" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-[var(--color-bg-alt)]" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="h-3 w-20 rounded bg-[var(--color-bg-alt)]" />
            <div className="mt-3 h-7 w-24 rounded-lg bg-[var(--color-bg-alt)]" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <div className="h-4 w-40 rounded bg-[var(--color-bg-alt)]" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3 last:border-0"
          >
            <div className="h-4 w-1/3 rounded bg-[var(--color-bg-alt)]" />
            <div className="h-4 w-1/4 rounded bg-[var(--color-bg-alt)]" />
            <div className="hidden h-4 w-16 rounded bg-[var(--color-bg-alt)] sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
