"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function TenantBadge({ size = "sm", tenant }: { size?: "sm" | "lg"; tenant: any }) {
  const t = useTranslations("alpha");
  return (
    <span className={cn("inline-flex items-center gap-2", size === "lg" ? "px-3 py-1.5" : "px-2 py-1")}>
      <Image
        src="/onespec-logo.png"
        alt="onespec"
        width={2000}
        height={700}
        className={cn("logo-dark h-5 w-auto", size === "lg" && "h-6")}
      />
      <Image
        src="/onespec-logo-light.png"
        alt="onespec"
        width={2000}
        height={700}
        className={cn("logo-light h-5 w-auto", size === "lg" && "h-6")}
      />
      <span className={cn("text-sm font-medium", size === "lg" && "text-base")}>
        {t("member")}
      </span>
      <span className={cn("w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]", size === "lg" && "w-2 h-2")} aria-hidden="true" />
    </span>
  );
}