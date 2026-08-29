import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="focus:outline-none focus:ring-2 focus:ring-[var(--color-mint)] rounded">
            <Logo className="h-8" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-2xl p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-[var(--color-text-secondary)] text-sm">
          {t("footer")}
        </p>
      </div>
    </div>
  );
}