import { useTranslations } from "next-intl";

/** WCAG 2.4.1 Bypass Blocks — visually hidden until focused (keyboard/screen-reader only). */
export function SkipToMainContent({ targetId = "main-content" }: { targetId?: string }) {
  const t = useTranslations("a11y");
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-lg focus:bg-[var(--color-mint)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--color-mint-dark)] focus:shadow-lg"
    >
      {t("skipToContent")}
    </a>
  );
}
