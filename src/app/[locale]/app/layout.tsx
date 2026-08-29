import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { isAuthenticatedNextjs, convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMessages } from "next-intl/server";
import { api } from "@/convex/_generated/api";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const authed = await isAuthenticatedNextjs();
  if (!authed) {
    redirect(`/${locale}/auth/login`);
  }

  const token = await convexAuthNextjsToken();
  const tenant = await fetchQuery(api.tenants.getMyTenant, {}, { token });

  if (!tenant) {
    redirect(`/${locale}/auth/onboarding`);
  }

  if (tenant.suspendedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Account sospeso</h1>
          <p className="text-[var(--color-text-secondary)]">{tenant.suspendedReason || "Il tuo account è stato sospeso. Contatta il supporto."}</p>
        </div>
      </div>
    );
  }

  const messages = await getMessages();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex">
      <Sidebar tenant={tenant} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar tenant={tenant} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}