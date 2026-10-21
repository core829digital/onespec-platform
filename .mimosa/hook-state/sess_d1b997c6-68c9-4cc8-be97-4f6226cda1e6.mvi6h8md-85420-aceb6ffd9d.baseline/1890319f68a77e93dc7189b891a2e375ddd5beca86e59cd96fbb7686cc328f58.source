"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale, useTranslations } from "next-intl";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/navigation";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import { defaultItem } from "@/shared/item-defaults";
import { duplicateItem, blockingIssues, pieceIssues } from "@/shared/piece-ops";
import { saveShowroomHandoff } from "@/lib/showroom-handoff";
import { PiecesEditor } from "@/components/quotes/editor/pieces-editor";
import { ConfiguratorPicker, resolveChoice, type PickerConfigurator } from "@/components/showroom/configurator-picker";
import { FiscalEngine, type FiscalCalc } from "@/components/showroom/FiscalEngine";
import { buildExportModel } from "@/lib/quote-export/model";
import { buildTxt, buildWhatsApp, whatsAppUrl } from "@/lib/quote-export/generators";
import { buildBackup, parseBackup } from "@/lib/quote-export/backup";
import { clearDraft, useDraftRestore, useDraftSave } from "@/lib/use-draft";
import { usePlanAccess } from "@/lib/plan-gates";
import { useFriendlyError } from "@/lib/use-friendly-error";

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

/** Reads / writes the configurator chosen for the Showroom, per tenant, in this browser. */
const choiceKey = (tenantId: string) => `onespec-showroom-configurator:${tenantId}`;
function readChoice(tenantId: string): string | null {
  try {
    return localStorage.getItem(choiceKey(tenantId));
  } catch {
    return null;
  }
}
function writeChoice(tenantId: string, id: string) {
  try {
    localStorage.setItem(choiceKey(tenantId), id);
  } catch {
    /* a convenience only */
  }
}

export default function ShowroomPage() {
  const t = useTranslations("showroom");
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(api.configurators.listConfigurators, tenant ? { tenantId: tenant._id } : "skip");
  const [chosen, setChosen] = useState<string | null>(null);

  // The choice: what was just picked, else what this browser remembers, else the server's default (latest published).
  const remembered = tenant && typeof window !== "undefined" ? readChoice(tenant._id) : null;
  const wanted = resolveChoice((configurators ?? []) as PickerConfigurator[], chosen, remembered);
  const catalog = useQuery(
    api.calculations.getShowroomCatalog,
    tenant ? { tenantId: tenant._id, ...(wanted ? { configuratorId: wanted as Id<"configurators"> } : {}) } : "skip",
  );
  const catalogReady = catalog?.ready === true;
  const inUse = catalogReady ? (catalog.configuratorId as string) : undefined;

  const picker = tenant && catalog && !("allowed" in catalog && catalog.allowed === false) ? (
    <ConfiguratorPicker
      configurators={(configurators ?? []) as PickerConfigurator[]}
      value={inUse}
      onChange={(id) => {
        setChosen(id);
        writeChoice(tenant._id, id);
      }}
    />
  ) : null;

  if (tenant && catalog && !catalogReady) {
    return (
      <div className="w-full space-y-4">
        <h1 className="text-xl font-semibold">Showroom</h1>
        {picker}
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

  if (!tenant || !catalog || !catalogReady) {
    return <p className="text-sm text-[var(--color-muted-fg)]">{t("loading")}</p>;
  }

  // Remounted on every change of configurator: pieces, draft and fiscal options start clean for its catalogue.
  return <ShowroomWorkspace key={`${tenant._id}:${inUse}`} tenant={tenant} catalog={catalog} configuratorId={inUse!} picker={picker} />;
}

function ShowroomWorkspace({
  tenant,
  catalog,
  configuratorId,
  picker,
}: {
  tenant: NonNullable<FunctionReturnType<typeof api.tenants.getMyTenant>>;
  catalog: Extract<FunctionReturnType<typeof api.calculations.getShowroomCatalog>, { ready: true }>;
  configuratorId: string;
  picker: React.ReactNode;
}) {
  const t = useTranslations("showroom");
  const locale = useLocale();
  const router = useRouter();
  const [itemsState, setItems] = useState<ProjectItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [buildingAge, setBuildingAge] = useState(20);
  const [isEnergyRenovation, setIsEnergyRenovation] = useState(true);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [restoredCount, setRestoredCount] = useState(0);
  const [sendErr, setSendErr] = useState("");
  const registerSend = useMutation(api.usage.registerShowroomSend);
  const access = usePlanAccess(tenant._id);
  const tf = useFriendlyError();

  const payload = catalog.payload as CatalogPayload;
  const ready = true;
  const region = catalog.regionCode as Region;
  const seed = useMemo(() => [defaultItem(payload, "finestra2")], [payload]);
  const items = itemsState ?? seed;
  // One draft per configurator: its pieces refer to that catalogue's keys.
  const draftKey = `showroom:${tenant._id}:${configuratorId}`;

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
    items.length > 0
      ? { tenantId: tenant._id, configuratorId: configuratorId as Id<"configurators">, items, options: { regionCode: region, buildingAge, isEnergyRenovation, deductionPercent: 50 } }
      : "skip",
  );

  const blocked = items.some((it) => blockingIssues(pieceIssues(it, payload)).length > 0);

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

  const fiscalOptions = { regionCode: region, buildingAge, isEnergyRenovation, deductionPercent: 50 };

  // Every quote that leaves the showroom is registered server-side first
  // (monthly showroom caps on the widget-first plans; no-op on the others).
  async function metered(channel: "pdf" | "whatsapp"): Promise<boolean> {
    if (!tenant) return false;
    setSendErr("");
    try {
      await registerSend({ tenantId: tenant._id, channel, items, options: fiscalOptions });
      return true;
    } catch (e) {
      setSendErr(tf(e));
      return false;
    }
  }

  async function whatsapp() {
    const m = exportModel(false);
    if (!m) return;
    const win = window.open("about:blank", "_blank");
    if (!(await metered("whatsapp"))) {
      win?.close();
      return;
    }
    const url = whatsAppUrl(buildWhatsApp(m), clientPhone, region);
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  async function exportDocument() {
    const m = exportModel(false);
    if (m && (await metered("pdf"))) download("showroom-offerta.txt", "text/plain", buildTxt(m));
  }

  async function restoreFile(file: File | undefined) {
    if (!file || file.size > 2 * 1024 * 1024) return; // a saved quote draft is a few KB: anything bigger is not one
    const draft = parseBackup(await file.text());
    if (!draft || draft.items.length === 0) return;
    setItems(draft.items);
    setActive(0);
    setClientName(draft.meta.clientName ?? clientName);
    setClientPhone(draft.meta.clientPhone ?? clientPhone);
    setClientCity(draft.meta.clientCity ?? clientCity);
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">{t("subtitle")}</p>
      </div>

      {picker}

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
              onWhatsApp={() => void whatsapp()}
              onSopralluogo={access && !access.isLocked("fieldQuotes") ? requestSurvey : undefined}
              onAddToCart={() => {
                const next = duplicateItem(items, Math.min(active, items.length - 1));
                setItems(next);
                setActive(Math.min(active, items.length - 1) + 1);
              }}
            />
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] p-5 text-sm text-[var(--color-muted-fg)]">{t("configureToSee")}</div>
          )}
          {sendErr ? <p role="alert" className="rounded-lg border border-[var(--color-danger)]/40 p-3 text-xs text-[var(--color-danger)]">{sendErr}</p> : null}
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
              <button type="button" className={ghost} disabled={!calc} onClick={() => void exportDocument()}>{t("exportTxt")}</button>
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
