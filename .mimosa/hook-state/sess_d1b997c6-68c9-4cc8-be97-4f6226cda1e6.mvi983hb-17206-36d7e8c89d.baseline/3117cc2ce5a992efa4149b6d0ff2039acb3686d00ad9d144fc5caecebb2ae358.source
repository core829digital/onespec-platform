"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";

/**
 * Every page under /app/admin/support belongs to the platform team. Someone else who types the address gets the same "no access" notice as
 * the admin page — and the pages (which call admin-only functions) are never even rendered for them.
 */
export default function AdminSupportLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (viewer?.isPlatformAdmin !== true) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)]">{t("noAccess")}</p>
        <Link href="/app/dashboard" className="text-[var(--color-mint-text)] hover:underline">{t("dashboard")}</Link>
      </div>
    );
  }
  return <>{children}</>;
}
