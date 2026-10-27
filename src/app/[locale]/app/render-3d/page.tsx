"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { catalogOptions, catalogPricing, freshWidgetState, type WidgetCatalog } from "@/components/widget/widget-catalog";
import { LOCALE_CFG, getDict } from "@/components/widget/widget-i18n";
import type { ConfigState } from "@/components/widget/widget-pricing";
import { WidgetRender3D } from "@/components/widget/widget-render3d-studio";
import { prefetch3d } from "@/components/render3d/Render3DStudioLazy";

/**
 * The 3D render of the new window in the customer's home, without the public widget. It opens full screen straight away (the 3D studio is
 * a full-screen layer with a floating menu); "back" returns to the page that was before. The windows on offer are those of one of the
 * company's published configurators (or the standard ones when there is none yet), so colours, hardware, accessories and openings are the real ones.
 */
export default function Render3DPage() {
  const t = useTranslations("render3d");
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(api.configurators.listConfigurators, tenant ? { tenantId: tenant._id } : "skip");
  const [chosen, setChosen] = useState<string | null>(null);
  // The page is only about the 3D: its code downloads while the company's data loads.
  useEffect(() => prefetch3d(), []);

  const published = useMemo(() => (configurators ?? []).filter((c) => c.status === "published" && c.publishedCatalogVersion !== undefined), [configurators]);
  const current = published.find((c) => c._id === chosen) ?? published[0];
  const cfg = useQuery(api.widget.getPublicConfigurator, current ? { publicId: current.publicId } : "skip");

  if (tenant === undefined || configurators === undefined || (current && cfg === undefined)) {
    return <p className="text-sm text-[var(--color-muted-fg)]">{t("loading")}</p>;
  }

  const catalog = (cfg?.catalog ?? undefined) as WidgetCatalog | undefined;
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted-fg)]">{t("subtitle")}</p>
      </div>
      {published.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] p-3">
          <label className="block min-w-[220px] flex-1 text-sm" htmlFor="render3d-configurator">
            <span className="text-[var(--color-muted-fg)]">{t("configurator")}</span>
            <select
              id="render3d-configurator"
              value={current?._id ?? ""}
              onChange={(e) => setChosen(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              {published.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="basis-full text-xs text-[var(--color-muted-fg)]">{t("configuratorHelp")}</p>
        </div>
      ) : (
        <p className="rounded-xl border border-[var(--color-border)] p-3 text-sm text-[var(--color-muted-fg)]">
          {t("noConfigurator")}{" "}
          <Link href="/app/configurators" className="text-[var(--color-mint-text)] hover:underline">
            {t("manage")}
          </Link>
        </p>
      )}
      {/* Remounted for each configurator: the piece starts clean for its catalogue. */}
      <Render3DWorkspace key={current?._id ?? "default"} catalog={catalog} />
    </div>
  );
}

function Render3DWorkspace({ catalog }: { catalog: WidgetCatalog | undefined }) {
  const t = useTranslations("render3d");
  const locale = useLocale();
  const router = useRouter();
  const dict = getDict(locale);
  const cfg = LOCALE_CFG[locale] ?? LOCALE_CFG.en;
  const options = useMemo(() => catalogOptions(catalog, dict, cfg.locale), [catalog, dict, cfg.locale]);
  const pricing = useMemo(() => catalogPricing(catalog), [catalog]);
  const [state, setState] = useState<ConfigState>(() => freshWidgetState(options));
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button type="button" data-testid="render3d-reopen" onClick={() => setOpen(true)} className="rounded-xl bg-[var(--color-mint)] px-5 py-3 text-sm font-semibold text-black">
        {t("open")}
      </button>
    );
  }
  // Closing the full-screen 3D leaves the page (back to where the user came from); the button above is for when there is nowhere to go back to.
  return <WidgetRender3D lang={locale} options={options} pricing={pricing} state={state} setState={setState} onClose={() => (window.history.length > 1 ? router.back() : setOpen(false))} />;
}
