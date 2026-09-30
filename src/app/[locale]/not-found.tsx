import { getLocale } from "next-intl/server";
import { NotFoundView } from "@/components/not-found-view";
import { toErrorLocale } from "@/lib/error-copy";

export default async function LocaleNotFound() {
  const locale = toErrorLocale(await getLocale()) ?? "it";
  return <NotFoundView locale={locale} homeHref={locale === "it" ? "/" : `/${locale}`} />;
}
