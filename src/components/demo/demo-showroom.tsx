"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import { defaultItem } from "@/shared/item-defaults";
import { duplicateItem, blockingIssues, pieceIssues } from "@/shared/piece-ops";
import { PiecesEditor } from "@/components/quotes/editor/pieces-editor";
import { FiscalEngine, type FiscalCalc } from "@/components/showroom/FiscalEngine";
import { computeCalculationPreview } from "@/convex/lib/calcPreview";
import { postToHost } from "@/components/widget/host-bridge";
import { demoCopy, demoRegisterUrl } from "@/lib/demo/demo-copy";
import demo from "@/lib/demo/demo-data.json";

const input = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";
const ghost = "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--color-mint)]";

const payload = demo.showroom.payload as unknown as CatalogPayload;
const region = demo.showroom.regionCode as "IT";
const DEMO_ID = "DEMOSHOWROOM";

/**
 * Showroom demo for onespec.eu. Same editor and fiscal engine as the platform,
 * computed locally from a static catalogue: no account, no network, nothing to
 * abuse. Anything that would send or export a quote shows the demo notice.
 */
export function DemoShowroom({ lang, theme }: { lang: string; theme: "light" | "dark" | "auto" }) {
  const t = useTranslations("showroom");
  const locale = useLocale();
  const dc = demoCopy(lang);
  const seed = useMemo(() => [defaultItem(payload, "finestra2")], []);
  const [items, setItems] = useState<ProjectItem[]>(seed);
  const [active, setActive] = useState(0);
  const [buildingAge, setBuildingAge] = useState(20);
  const [isEnergyRenovation, setIsEnergyRenovation] = useState(true);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const light =
      theme === "light" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: light)").matches);
    if (light) root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
  }, [theme]);

  useEffect(() => {
    const post = () => postToHost({ type: "onespec:resize", publicId: DEMO_ID, height: document.body.scrollHeight });
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    postToHost({ type: "onespec:ready", publicId: DEMO_ID });
    return () => ro.disconnect();
  }, []);

  const blocked = items.some((it) => blockingIssues(pieceIssues(it, payload)).length > 0);
  const calc = useMemo(() => {
    if (items.length === 0 || blocked) return null;
    try {
      return computeCalculationPreview(payload, demo.configurator.catalogVersion as never, items, {
        regionCode: region,
        buildingAge,
        isEnergyRenovation,
        deductionPercent: 50,
      });
    } catch {
      return null;
    }
  }, [items, blocked, buildingAge, isEnergyRenovation]);

  const noticeCard = notice ? (
    <div role="status" className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 p-4 text-sm">
      <div className="font-semibold">{dc.title}</div>
      <p className="mt-1 text-[var(--color-muted-fg)]">{dc.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={demoRegisterUrl(lang)} target="_top" className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-xs font-bold text-[var(--color-mint-dark)]">
          {dc.cta}
        </a>
        <button type="button" className={ghost} onClick={() => setNotice(false)}>
          {dc.back}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full space-y-4 p-3 sm:p-4">
      <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4">
        <PiecesEditor
          payload={payload}
          locale={locale}
          items={items}
          onChange={setItems}
          activeIndex={Math.min(active, Math.max(0, items.length - 1))}
          onActiveChange={setActive}
        />
        <div className="grid gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={isEnergyRenovation} onChange={(e) => setIsEnergyRenovation(e.target.checked)} />
            {t("energyRenovation")}
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-muted-fg)]">{t("buildingAge")}</span>
            <input type="number" min={0} value={buildingAge} onChange={(e) => setBuildingAge(Math.max(0, Number(e.target.value) || 0))} className={`${input} w-28`} />
          </label>
        </div>
      </div>

      {calc ? (
        <FiscalEngine
          calc={calc as unknown as FiscalCalc}
          regionCode={region}
          onWhatsApp={() => setNotice(true)}
          onAddToCart={() => {
            const i = Math.min(active, items.length - 1);
            setItems(duplicateItem(items, i));
            setActive(i + 1);
          }}
        />
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] p-5 text-sm text-[var(--color-muted-fg)]">
          {blocked ? t("fixPieces") : t("configureToSee")}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={ghost} disabled={!calc} onClick={() => setNotice(true)}>
          {t("exportTxt")}
        </button>
      </div>
      {noticeCard}
    </div>
  );
}
