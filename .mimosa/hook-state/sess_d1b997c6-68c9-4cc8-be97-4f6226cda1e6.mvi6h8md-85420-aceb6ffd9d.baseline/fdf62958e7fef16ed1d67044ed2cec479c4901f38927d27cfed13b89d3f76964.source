"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  FRAME_ONLY_SHARE,
  SUPPLY_FACTOR,
  PRICE_ZONES,
  QUALITY_CLASS_LABEL,
  STANDARD_PROFILES,
  ZONE_REGIONS,
  applyMarginCents,
  averageComplete,
  marginOnPricePercent,
  type PriceZone,
  type QualityClass,
} from "@/shared/standard-pricing";

const CLASSES: QualityClass[] = ["economica", "media", "mediaSuperiore", "premium"];
const EXAMPLE_BASE_CENTS = 50000;
const EXAMPLE_MARGIN = 20;

type Lang = keyof (typeof QUALITY_CLASS_LABEL)["media"];
const LANGS: readonly Lang[] = ["it", "en", "fr", "de", "nl", "ro"];

/** The installer's guide to the standard price list: what the prices are, zones, classes, factors, margin, method, disclaimer. */
export function PriceGuide() {
  const t = useTranslations("priceGuide");
  const tz = useTranslations("priceZone");
  const locale = useLocale();
  const lang: Lang = (LANGS as readonly string[]).includes(locale) ? (locale as Lang) : "en";
  const eur = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const pct = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const range = (r: readonly [number, number]) => `${r[0]}–${r[1]}`;

  const finalCents = applyMarginCents(EXAMPLE_BASE_CENTS, EXAMPLE_MARGIN);
  const section = "space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5";
  const h = "font-semibold text-[var(--color-text)]";
  const p = "text-sm text-[var(--color-text-secondary)]";

  return (
    <article className="space-y-4" aria-labelledby="price-guide-title">
      <header className="space-y-1">
        <h2 id="price-guide-title" className="text-lg font-bold text-[var(--color-text)]">{t("title")}</h2>
        <p className={p}>{t("intro")}</p>
      </header>

      <section className={section}>
        <h3 className={h}>{t("whatTitle")}</h3>
        <ul className={`${p} list-disc space-y-1 pl-5`}>
          <li>{t("whatComplete")}</li>
          <li>{t("whatFrame", { share: Math.round(FRAME_ONLY_SHARE * 100) })}</li>
          <li>{t("whatMid")}</li>
        </ul>
        <p className={`${p} font-medium`}>{t("calibration", { pct: pct((1 - SUPPLY_FACTOR.numerator / SUPPLY_FACTOR.denominator) * 100) })}</p>
      </section>

      <section className={section}>
        <h3 className={h}>{t("zonesTitle")}</h3>
        <p className={p}>{t("zonesIntro")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRICE_ZONES.map((z: PriceZone) => (
            <div key={z} className="rounded-lg border border-[var(--color-border)] p-3">
              <p className="font-bold text-[var(--color-text)]">{tz(`${z}.name`)}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{ZONE_REGIONS[z].join(", ")}</p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t("zoneAvg")}</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{eur(averageComplete(z))}/m²</p>
            </div>
          ))}
        </div>
        <p className={p}>{t("zonesDelta")}</p>
      </section>

      <section className={section}>
        <h3 className={h}>{t("classesTitle")}</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {CLASSES.map((c) => (
            <div key={c} className="rounded-lg border border-[var(--color-border)] p-3">
              <dt className="font-semibold text-[var(--color-text)]">{QUALITY_CLASS_LABEL[c][lang]}</dt>
              <dd className={p}>{t(`class.${c}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={section}>
        <h3 className={h}>{t("tableTitle")}</h3>
        <p className={p}>{t("tableNote")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-xs text-[var(--color-text)]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                <th scope="col" className="py-2 pr-3">{t("colProfile")}</th>
                <th scope="col" className="py-2 pr-3">{t("colClass")}</th>
                {PRICE_ZONES.map((z) => (
                  <th key={z} scope="col" className="py-2 pr-3">{tz(`${z}.name`)}</th>
                ))}
                <th scope="col" className="py-2 pr-3">{t("colBar")}</th>
                <th scope="col" className="py-2">{t("colGlass")}</th>
              </tr>
            </thead>
            <tbody>
              {STANDARD_PROFILES.map((sp) => (
                <tr key={sp.key} className="border-b border-[var(--color-border)] last:border-0">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {sp.name}
                    <span className="block font-normal text-[var(--color-text-secondary)]">
                      {sp.chambers} {t("chambers")} · {sp.thicknessMm} mm{sp.feature ? ` · ${sp.feature}` : ""}
                    </span>
                  </th>
                  <td className="py-2 pr-3">{QUALITY_CLASS_LABEL[sp.klass][lang]}</td>
                  {PRICE_ZONES.map((z) => (
                    <td key={z} className="py-2 pr-3">
                      {range(sp.prices[z].complete)}
                      <span className="block text-[var(--color-text-secondary)]">{t("frameOnlyShort")} {range(sp.prices[z].frame)}</span>
                    </td>
                  ))}
                  <td className="py-2 pr-3">{range(sp.bar)}</td>
                  <td className="py-2">{range(sp.glass)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={section}>
        <h3 className={h}>{t("factorsTitle")}</h3>
        <ul className={`${p} list-disc space-y-1 pl-5`}>
          <li>{t("factorTriple")}</li>
          <li>{t("factorColour")}</li>
          <li>{t("factorOther")}</li>
        </ul>
      </section>

      <section className={section}>
        <h3 className={h}>{t("marginTitle")}</h3>
        <p className={p}>{t("marginBody")}</p>
        <p className={`${p} font-medium`}>
          {t("marginExample", {
            base: eur(EXAMPLE_BASE_CENTS / 100),
            margin: pct(EXAMPLE_MARGIN),
            final: eur(finalCents / 100),
            gain: eur((finalCents - EXAMPLE_BASE_CENTS) / 100),
            onPrice: pct(marginOnPricePercent(EXAMPLE_MARGIN)),
          })}
        </p>
      </section>

      <section className={section}>
        <h3 className={h}>{t("methodTitle")}</h3>
        <p className={p}>{t("methodBody")}</p>
        <h3 className={`${h} pt-2`}>{t("disclaimerTitle")}</h3>
        <p className={p}>{t("disclaimerBody")}</p>
      </section>
    </article>
  );
}
