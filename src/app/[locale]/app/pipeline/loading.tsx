import { SkeletonContainer, SkeletonHeader, SkeletonCardGrid } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <SkeletonCardGrid count={4} cols={4} />
    </SkeletonContainer>
  );
}