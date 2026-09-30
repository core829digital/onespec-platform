import Link from "next/link";
import { ERROR_COPY, type ErrorLocale } from "@/lib/error-copy";

/** 404 body in a given language. Plain <Link>, so it works outside the [locale] tree too. */
export function NotFoundView({
  locale,
  variant = "page",
  homeHref = "/",
  fullScreen = false,
}: {
  locale: ErrorLocale;
  variant?: "page" | "configurator";
  homeHref?: string;
  fullScreen?: boolean;
}) {
  const c = ERROR_COPY[locale];
  const configurator = variant === "configurator";
  return (
    <div
      className={`${fullScreen ? "min-h-screen" : "min-h-[60vh]"} flex items-center justify-center p-8 bg-[var(--color-bg)] text-[var(--color-text)]`}
    >
      <div className="max-w-sm text-center">
        {configurator ? null : <p className="text-5xl font-bold text-[var(--color-mint)]">404</p>}
        <h1 className={configurator ? "text-lg font-semibold" : "mt-3 text-xl font-semibold"}>
          {configurator ? c.configuratorMissingTitle : c.notFoundTitle}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {configurator ? c.configuratorMissingBody : c.notFoundBody}
        </p>
        {configurator ? null : (
          <Link
            href={homeHref}
            className="mt-5 inline-flex items-center rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
          >
            {c.home}
          </Link>
        )}
      </div>
    </div>
  );
}
