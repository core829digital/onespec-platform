import { AdminMfaNudge } from "@/components/app-shell/admin-mfa-nudge";
import { SectionBoundary } from "@/components/section-boundary";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionBoundary>
        <AdminMfaNudge />
      </SectionBoundary>
      {children}
    </>
  );
}
