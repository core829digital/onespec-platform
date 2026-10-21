import { SkeletonContainer } from "@/components/ui/skeleton";

/**
 * Same skeleton as the finished dashboard: header + range switcher, quick actions, five KPI cards (same grid classes), two panels,
 * two panels, the recent list. The page does not jump when the real content replaces it.
 */
function Panel({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-5">
      <div className="mb-4 h-5 w-40 rounded bg-[var(--color-bg-alt)]" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded-lg bg-[var(--color-bg-alt)]" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <SkeletonContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h-8 w-56 rounded-lg bg-[var(--color-bg-alt)]" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-[var(--color-bg-alt)]" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-[var(--color-bg-alt)]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[36, 32, 32].map((w, i) => (
          <div key={i} className="h-10 rounded-lg bg-[var(--color-bg-alt)]" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="h-4 w-24 rounded bg-[var(--color-bg-alt)] sm:h-5" />
            <div className="mt-1.5 h-8 w-28 rounded-lg bg-[var(--color-bg-alt)] sm:h-9" />
            <div className="mt-1 h-[1.125rem] w-12 rounded bg-[var(--color-bg-alt)]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel rows={3} />
        <Panel rows={3} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel rows={3} />
        <Panel rows={3} />
      </div>
      <div className="rounded-xl border border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <div className="h-5 w-44 rounded bg-[var(--color-bg-alt)]" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-[var(--color-border)] px-5 py-4 last:border-0">
            <div className="h-4 w-40 rounded bg-[var(--color-bg-alt)]" />
            <div className="mt-2 h-3 w-24 rounded bg-[var(--color-bg-alt)]" />
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}
