import { SkeletonContainer, SkeletonHeader, SkeletonEmptyState } from "@/components/ui/skeleton";

export default function Render3DLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <SkeletonEmptyState />
    </SkeletonContainer>
  );
}
