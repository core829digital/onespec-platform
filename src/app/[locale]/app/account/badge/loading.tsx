import { SkeletonContainer, SkeletonHeader, SkeletonCard } from "@/components/ui/skeleton";

export default function AccountBadgeLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] p-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[var(--color-bg-alt)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-[var(--color-bg-alt)]" />
              <div className="h-3 w-24 rounded bg-[var(--color-bg-alt)]" />
            </div>
          </div>
        </div>
        <SkeletonCard />
      </div>
    </SkeletonContainer>
  );
}