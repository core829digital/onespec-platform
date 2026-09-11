import { SkeletonContainer, SkeletonHeader, SkeletonKPIs, SkeletonCardGrid } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <SkeletonKPIs count={4} />
      <SkeletonCardGrid count={4} cols={4} />
    </SkeletonContainer>
  );
}