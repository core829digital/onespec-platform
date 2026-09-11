import { SkeletonContainer, SkeletonHeader, SkeletonCardGrid, SkeletonCard } from "@/components/ui/skeleton";

export default function AccountBillingLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] p-4 animate-pulse">
          <div className="h-3 w-32 rounded bg-[var(--color-bg-alt)] mb-2" />
          <div className="h-6 w-40 rounded bg-[var(--color-bg-alt)]" />
        </div>
        <SkeletonCardGrid count={4} cols={4} />
      </div>
    </SkeletonContainer>
  );
}