import { SkeletonContainer, SkeletonHeader, SkeletonKPIs, SkeletonChart, SkeletonTable, SkeletonEmptyState } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <SkeletonKPIs count={4} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonChart height={300} />
        <SkeletonChart height={300} />
      </div>
      <SkeletonTable rows={6} cells={4} hasActions />
    </SkeletonContainer>
  );
}