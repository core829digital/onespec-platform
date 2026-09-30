import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { isAuthenticatedNextjs, convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getTranslations } from "next-intl/server";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell/app-shell";
import { ActionToaster } from "@/components/app-shell/action-toaster";
import { ConfirmDialog } from "@/components/app-shell/confirm-dialog";
import { DpaGate } from "@/components/app-shell/dpa-gate";
import { SetupGuideWidget } from "@/components/app-shell/setup-guide-widget";
import { LocaleSync } from "@/components/app-shell/locale-sync";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(await isAuthenticatedNextjs())) {
    redirect(`/${locale}/auth/login`);
  }

  const token = await convexAuthNextjsToken();
  const tenant = await fetchQuery(api.tenants.getMyTenant, {}, { token });

  if (!tenant) {
    redirect(`/${locale}/auth/onboarding`);
  }

  // No plan, no platform: a tenant still waiting for its plan goes back to the
  // plan step even if onboarding was somehow marked complete. Every data
  // mutation is also refused server-side (enforceActivePlan); this keeps the UI
  // from ever rendering for an unpaid account.
  if (!tenant.onboardingCompletedAt || tenant.planStatus === "pending_plan") {
    redirect(`/${locale}/onboarding`);
  }

  if (tenant.suspendedAt) {
    const t = await getTranslations("app.suspended");
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">{t("title")}</h1>
          <p className="text-[var(--color-text-secondary)]">{tenant.suspendedReason || t("body")}</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell tenant={tenant}>
      {children}
      <ActionToaster />
      <ConfirmDialog />
      <DpaGate />
      <SetupGuideWidget tenantId={tenant._id} />
      <LocaleSync />
    </AppShell>
  );
}
