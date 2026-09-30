import { cookies, headers } from "next/headers";
import { detectServerErrorLocale } from "@/lib/error-copy";
import { NotFoundView } from "@/components/not-found-view";

/** Not-found screen for routes outside the [locale] tree: language from cookie / Accept-Language. */
export async function NotFoundServer({
  variant = "page",
  fullScreen = false,
}: {
  variant?: "page" | "configurator";
  fullScreen?: boolean;
}) {
  const [c, h] = await Promise.all([cookies(), headers()]);
  const locale = detectServerErrorLocale(c.get("onespec-locale")?.value, h.get("accept-language"));
  return <NotFoundView locale={locale} variant={variant} fullScreen={fullScreen} homeHref={locale === "it" ? "/" : `/${locale}`} />;
}
