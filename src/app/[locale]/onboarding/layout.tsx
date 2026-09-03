import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { isAuthenticatedNextjs, convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function OnboardingLayout({
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
  if (tenant.onboardingCompletedAt) {
    redirect(`/${locale}/app/dashboard`);
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Logo className="h-7" />
        <ThemeToggle />
      </header>
      <main className="max-w-3xl mx-auto px-6 pb-16">{children}</main>
    </div>
  );
}
