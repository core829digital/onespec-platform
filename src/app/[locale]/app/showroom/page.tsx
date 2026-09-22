"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import { defaultItem } from "@/shared/item-defaults";
import { duplicateItem, blockingIssues, pieceIssues } from "@/shared/piece-ops";
import { saveShowroomHandoff } from "@/lib/showroom-handoff";
import { PiecesEditor } from "@/components/quotes/editor/pieces-editor";
import { FiscalEngine, type FiscalCalc } from "@/components/showroom/FiscalEngine";
import { buildExportModel } from "@/lib/quote-export/model";
import { buildTxt, buildWhatsApp, whatsAppUrl } from "@/lib/quote-export/generators";
import { buildBackup, parseBackup } from "@/lib/quote-export/backup";
import { clearDraft, useDraftRestore, useDraftSave } from "@/lib/use-draft";

type Region = "IT" | "FR" | "BE" | "NL" | "DE" | "LU";

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const input = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";
const ghost = "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--color-mint)]";

export default function ShowroomPage() {
  const t = useTranslations("showroom");
  const locale = useLocale();
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const catalog = useQuery(api.calculations.getShowroomCatalog, tenant ? { tenantId: tenant._id } : "skip");

  const [itemsState, setItems] = useState<ProjectItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [buildingAge, setBuildingAge] = useState(20);
  const [isEnergyRenovation, setIsEnergyRenovation] = useState(true);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [restoredCount, setRestoredCount] = useState(0);

  const ready = catalog?.ready === true;
  const payload = ready ? (catalog.payload as CatalogPayload) : undefined;
  const region = (catalog?.regionCode ?? "IT") as Region;
  const seed = useMemo(() => (payload ? [defaultItem(payload, "finestra2")] : []), [payload]);
  const items = itemsState ?? seed;
  const draftKey = tenant ? `showroom:${tenant._id}` : "showroom";

  useDraftRestore(draftKey, ready, (draft) => {
    setItems(draft.items);
    setClientName(draft.meta.clientName ?? "");
    setClientPhone(draft.meta.clientPhone ?? "");
    setClientCity(draft.meta.clientCity ?? "");
    setRestoredCount(draft.items.length);
  });
  useDraftSave(draftKey, itemsState, { clientName, clientPhone, clientCity });

  const calc = useQuery(
    api.calculations.getCalculationPreview,
    tenant && ready && items.length > 0
      ? { tenantId: tenant._id, items, options: { regionCode: region, buildingAge, isEnergyRenovation, deductionPercent: 50 } }
      : "skip",
  );

  const blocked = payload ? items.some((it) => blockingIssues(pieceIssues(it, payload)).length > 0) : false;

  function exportModel(drawings: boolean) {
    if (!payload || !calc) return null;
    const subsidyCents = region === "IT" ? calc.priceCents - calc.netAfterBonus50 : 0;
    return buildExportModel({
      locale,
      dateMs: Date.now(),
      company: { name: tenant?.name ?? "" },
      client: { name: clientName, phone: clientPhone, city: clientCity },
      items,
      payload,
      money: {
        supplyExVatCents: calc.priceExVatCents,
        installCents: 0,
        demolitionCents: 0,
        regionalCents: 0,
        discountPercent: 0,
        vatPercent: calc.vatRatePercent,
        grossCents: calc.priceCents,
        subsidyPercent: subsidyCents > 0 ? 50 : undefined,
        subsidyCents: subsidyCents > 0 ? subsidyCents : undefined,
      },
      validityDays: 30,
      drawings,
    });
  }

  function requestSurvey() {
    if (items.length > 0) {
      saveShowroomHandoff({ items, regionCode: region, buildingAge, isEnergyRenovation });
    }
    router.push("/app/quotes/new?from=showroom");
  }

  function whatsapp() {
    const m = exportModel(false);
    if (m) window.open(whatsAppUrl(buildWhatsApp(m), clientPhone, region), "_blank", "noopener");
  }

  async function restoreFile(file: File | undefined) {
    if (!file) return;
    const draft = parseBackup(await file.text());
    if (!draft || draft.items.length === 0) return;
    setItems(draft.items);
    setActive(0);
    setClientName(draft.meta.clientName ?? clientName);
    setClientPhone(draft.meta.clientPhone ?? clientPhone);
    setClientCity(draft.meta.clientCity ?? clientCity);
  }

  if (tenant && catalog && !ready) {
    return (
      <div className="w-full space-y-4">
        <h1 className="text-xl font-semibold">Showroom</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {"allowed" in catalog && catalog.allowed === false ? (
            <>
              {t("notAllowed")}{" "}
              <Link href="/app/account/billing?tab=plan" className="font-semibold underline">{t("seePlans")}</Link>
            </>
          ) : (
            t("noCatalog")
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">{t("subtitle")}</p>
      </div>

      {restoredCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 px-3 py-2 text-sm">
          <span>{t("draftRestored", { count: restoredCount })}</span>
          <button
            type="button"
            className="underline"
            onClick={() => {
              clearDraft(draftKey);
              setItems(null);
              setRestoredCount(0);
            }}
          >
            {t("discardDraft")}
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4">
          {payload ? (
            <PiecesEditor
              payload={payload}
              locale={locale}
              items={items}
              onChange={setItems}
              activeIndex={Math.min(active, Math.max(0, items.length - 1))}
              onActiveChange={setActive}
            />
          ) : (
            <p className="text-sm text-[var(--color-muted-fg)]">{t("loading")}</p>
          )}
          <div className="grid gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input id="showroom-energy-renovation" type="checkbox" checked={isEnergyRenovation} onChange={(e) => setIsEnergyRenovation(e.target.checked)} />
              {t("energyRenovation")}
            </label>
            <label className="block text-sm">
              <span className="text-[var(--color-muted-fg)]">{t("buildingAge")}</span>
              <input id="showroom-building-age" type="number" min={0} value={buildingAge} onChange={(e) => setBuildingAge(Math.max(0, Number(e.target.value) || 0))} className={`${input} w-28`} />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {calc ? (
            <FiscalEngine
              calc={calc as FiscalCalc}
              regionCode={region}
              onWhatsApp={whatsapp}
              onSopralluogo={requestSurvey}
              onAddToCart={() => {
                const next = duplicateItem(items, Math.min(active, items.length - 1));
                setItems(next);
                setActive(Math.min(active, items.length - 1) + 1);
              }}
            />
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] p-5 text-sm text-[var(--color-muted-fg)]">{t("configureToSee")}</div>
          )}
          {blocked ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">{t("fixPieces")}</p> : null}

          <div className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
            <div className="mb-2 font-semibold">{t("clientTitle")}</div>
            <div className="grid grid-cols-1 gap-2">
              <label className="block">
                <span className="text-[var(--color-muted-fg)]">{t("clientName")}</span>
                <input id="showroom-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t("clientName")} maxLength={100} className={input} />
              </label>
              <label className="block">
                <span className="text-[var(--color-muted-fg)]">{t("clientPhone")}</span>
                <input id="showroom-client-phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder={t("clientPhone")} inputMode="tel" maxLength={30} className={input} />
              </label>
              <label className="block">
                <span className="text-[var(--color-muted-fg)]">{t("clientCity")}</span>
                <input id="showroom-client-city" value={clientCity} onChange={(e) => setClientCity(e.target.value)} placeholder={t("clientCity")} maxLength={80} className={input} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={ghost} disabled={!calc} onClick={() => { const m = exportModel(false); if (m) download("showroom-offerta.txt", "text/plain", buildTxt(m)); }}>{t("exportTxt")}</button>
              <button type="button" className={ghost} onClick={() => download("showroom-bozza.json", "application/json", buildBackup(items, { clientName, clientPhone, clientCity }))}>{t("exportDraft")}</button>
              <label className={`${ghost} cursor-pointer`}>
                {t("loadDraft")}
                <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void restoreFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
