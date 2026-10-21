import { SkeletonContainer, SkeletonHeader, SkeletonKPIs, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <SkeletonKPIs count={4} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonChart height={300} />
        <SkeletonChart height={300} />
      </div>
      <SkeletonTable rows={8} cells={4} hasActions />
    </SkeletonContainer>
  );
}