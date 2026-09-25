"use client";

import { useTranslations } from "next-intl";
import { ErrorView } from "@/components/error-view";

export default function LocaleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary.generic");
  return <ErrorView {...props} title={t("title")} hint={t("hint")} retryLabel={t("retry")} />;
}
