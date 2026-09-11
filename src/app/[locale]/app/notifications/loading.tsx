import { SkeletonContainer, SkeletonHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <SkeletonContainer>
      <SkeletonHeader />
      <SkeletonTable rows={8} cells={3} hasActions={false} />
    </SkeletonContainer>
  );
}