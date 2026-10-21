import { useLocale } from "next-intl";
import { useMemo } from "react";

/** Euro formatter for cents, in the user's language. */
export function useEuro(): (cents: number) => string {
  const locale = useLocale();
  const fmt = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }), [locale]);
  return (cents: number) => fmt.format(cents / 100);
}

export const centsToInput = (cents: number | undefined): string => (cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ","));
