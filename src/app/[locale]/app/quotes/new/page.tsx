"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { takeShowroomHandoff } from "@/lib/showroom-handoff";
import { ClientCantierePicker, type PickedLinks } from "@/components/app-shell/client-cantiere-picker";
import { PiecesEditor } from "@/components/quotes/editor/pieces-editor";
import { defaultItem } from "@/shared/item-defaults";
import { blockingIssues, pieceIssues } from "@/shared/piece-ops";
import { clearDraft, useDraftRestore, useDraftSave } from "@/lib/use-draft";
import { MultiSupplierTable, type SupplierItem } from "@/components/quotes/MultiSupplierTable";
import {
  calculatePrice,
  computeOverallUw,
  computeInstallation,
  REGION_FLAT_OPTION_KINDS,
  type ProjectItem,
  type CatalogPayload,
} from "@/shared/pricing";

const REGION_OPTION_LABELS: Record<string, string> = {
  poseType: "Tipo di posa",
  ventilationGrille: "Griglia di ventilazione",
  voletRoulant: "Tapparella / Volet",
  warmEdge: "Distanziatore warm-edge",
  profileDepth: "Profondità profilo",
  cornerJoint: "Giunto d'angolo",
  ugTier: "Vetro (Ug)",
  colorPreset: "Colore preset",
  inmeetservice: "Servizio di rilievo",
  sunProtection: "Oscuramento (tapparella / frangisole)",
  securityClass: "Antieffrazione (RC2 / RC3)",
  montageSystem: "Sistema di montaggio",
};
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";

const EMPTY_PAYLOAD = {
  configurator: { publicId: "draft", name: "", defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1, showPricesToEndUser: true, currency: "EUR" },
  branding: null,
  materials: [],
  qualityTiers: [],
  profileSystems: [],
  sizeConstraints: [],
  glazing: [],
  finish: [],
  hardware: [],
  frameTypes: [],
  accessories: [],
  productBase: [],
} as unknown as CatalogPayload;

type ConfiguratorDoc = Doc<"configurators">;
type RegionCode = "IT" | "FR" | "BE" | "NL" | "DE" | "LU";

interface RegionMeta {
  code: RegionCode;
  flag: string;
  name: string;
  sub: string;
  defaultVat: number;
  vatOptions: Array<{ percent: number; label: string }>;
  defaultDeposit: string;
  defaultLocale: string;
}

const REGION_CONFIGS: Record<RegionCode, RegionMeta> = {
  IT: {
    code: "IT",
    flag: "🇮🇹",
    name: "Italia",
    sub: "UNI 11673 & Ecobonus",
    defaultVat: 10,
    vatOptions: [
      { percent: 10, label: "10% (Ristrutturazione)" },
      { percent: 22, label: "22% (Ordinaria)" },
      { percent: 4, label: "4% (Prima Casa)" },
    ],
    defaultDeposit: "30% ordine · 60% merce pronta · 10% fine posa",
    defaultLocale: "it",
  },
  FR: {
    code: "FR",
    flag: "🇫🇷",
    name: "France",
    sub: "DTU 36.5 & MaPrimeRénov'",
    defaultVat: 5.5,
    vatOptions: [
      { percent: 5.5, label: "5,5% (Rénovation énergétique)" },
      { percent: 10, label: "10% (Rénovation standard)" },
      { percent: 20, label: "20% (Neuf)" },
    ],
    defaultDeposit: "Acompte 30% à la commande · 70% à la livraison et fin de pose",
    defaultLocale: "fr",
  },
  BE: {
    code: "BE",
    flag: "🇧🇪",
    name: "Belgique / België",
    sub: "TVA 6%/21% & Renson / Volet",
    defaultVat: 6,
    vatOptions: [
      { percent: 6, label: "6% (Logement > 10 ans)" },
      { percent: 21, label: "21% (Standard / Neuf)" },
    ],
    defaultDeposit: "Acompte 30% à la commande · 60% à la pose · 10% réception",
    defaultLocale: "fr",
  },
  NL: {
    code: "NL",
    flag: "🇳🇱",
    name: "Nederland",
    sub: "Blokprofiel 120mm & HVL 90°",
    defaultVat: 21,
    vatOptions: [
      { percent: 21, label: "21% btw (Standaard)" },
      { percent: 9, label: "9% btw (Arbeid isolatie)" },
    ],
    defaultDeposit: "10% bij opdracht · 90% na montage en oplevering",
    defaultLocale: "nl",
  },
  DE: {
    code: "DE",
    flag: "🇩🇪",
    name: "Deutschland",
    sub: "RAL-Montage, RC2/RC3 & 3-fach",
    defaultVat: 19,
    vatOptions: [
      { percent: 19, label: "19% MwSt. (Regelsteuersatz)" },
      { percent: 0, label: "0% (Steuerfreie innergem. Lieferung)" },
    ],
    defaultDeposit: "30% Anzahlung bei Auftrag · 70% nach Fertigstellung",
    defaultLocale: "de",
  },
  LU: {
    code: "LU",
    flag: "🇱🇺",
    name: "Luxembourg",
    sub: "TVA 3% & Bilingue DE/FR",
    defaultVat: 3,
    vatOptions: [
      { percent: 3, label: "3% (Taux super-réduit logement)" },
      { percent: 17, label: "17% (TVA standard)" },
    ],
    defaultDeposit: "30% Acompte / Anzahlung · 70% Solde / Restbetrag",
    defaultLocale: "fr",
  },
};

export default function NewFieldQuotePage() {
  const tf = useFriendlyError();
  const t = useTranslations("quotes.new");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(
    api.configurators.listConfigurators,
    tenant ? { tenantId: tenant._id } : "skip",
  );

  const publishedConfigs = useMemo(
    () => (configurators ?? []).filter((c: ConfiguratorDoc) => c.status === "published"),
    [configurators],
  );

  const [selectedConfigId, setSelectedConfigId] = useState<string>(
    () => searchParams.get("config") ?? "",
  );
  const [regionCode, setRegionCode] = useState<RegionCode>("IT");

  // Customer state
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

  // Client / cantiere link — pick once, everything below prefills.
  const [clientId, setClientId] = useState<Id<"clients"> | undefined>(undefined);
  const [cantiereId, setCantiereId] = useState<Id<"cantieri"> | undefined>(undefined);
  const handleLinks = useCallback((next: PickedLinks) => {
    setClientId(next.clientId);
    setCantiereId(next.cantiereId);
    const c = next.client;
    if (c) {
      setLeadName(c.name);
      if (c.email) setLeadEmail(c.email);
      if (c.phone) setLeadPhone(c.phone);
      if (c.siteAddress) setCustomerAddress(c.siteAddress);
      if (c.siteCity) setCustomerCity(c.siteCity);
      if (c.sitePostalCode) setCustomerPostalCode(c.sitePostalCode);
    }
  }, []);

  // Base calculation & options
  const [installationType, setInstallationType] = useState("posa_qualificata_uni_11673");
  const [installationEuros, setInstallationEuros] = useState(250);
  const [demolitionEuros, setDemolitionEuros] = useState(50);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [profitMarginPercent, setProfitMarginPercent] = useState(30);
  const [vatRatePercent, setVatRatePercent] = useState(10);
  const [depositTerms, setDepositTerms] = useState(REGION_CONFIGS.IT.defaultDeposit);

  // Regional specific fields
  // IT
  const [ecobonusPercent, setEcobonusPercent] = useState(50);
  // FR
  const [poseType, setPoseType] = useState("pose_renovation_dormant_existant");
  const [rgeCertificate, setRgeCertificate] = useState("RGE-QUALIBAT-2026");
  const [decennaleInsurance, setDecennaleInsurance] = useState("Assurance Décennale AXA N° 849204");
  const [maPrimeRenovPercent, setMaPrimeRenovPercent] = useState(25);
  // BE
  const [rensonGrilleWidthMm, setRensonGrilleWidthMm] = useState(0);
  const [voletMonoblocHeightMm, setVoletMonoblocHeightMm] = useState(0);
  // NL
  const [hvlJointCount, setHvlJointCount] = useState(4);
  const [isostoneSill, setIsostoneSill] = useState(false);
  const [inmeetServiceCost, setInmeetServiceCost] = useState(65);
  // DE / LU
  const [ralMontage, setRalMontage] = useState(true);
  const [rcSecurityLevel, setRcSecurityLevel] = useState("RC2");
  const [klimabonusEligible, setKlimabonusEligible] = useState(true);

  // Pieces: null until the dealer edits them, then the seed (built from the published catalogue) is replaced.
  const [itemsState, setItems] = useState<ProjectItem[] | null>(null);

  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Multi-supplier BOM state
  // Multi-supplier BOM: real suppliers from the tenant's directory, no demo rows.
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const supplierData = useQuery(api.suppliers.listSuppliers, tenant ? { tenantId: tenant._id } : "skip");
  const createSupplier = useMutation(api.suppliers.createSupplier);
  const [newSupplier, setNewSupplier] = useState("");
  const suppliers = useMemo(
    () => (supplierData?.suppliers ?? []).map((sup) => ({ name: sup.name, color: "" })),
    [supplierData],
  );

  const activeConfig = publishedConfigs.find(
    (c: ConfiguratorDoc) => c._id === (selectedConfigId || publishedConfigs[0]?._id),
  );

  // The SAME published catalog payload the embeddable B2C widget uses — keeps
  // B2B field-quote pricing and B2C site pricing identical.
  const publishedCatalog = useQuery(
    api.configurators.getPublishedCatalog,
    activeConfig ? { configuratorId: activeConfig._id } : "skip",
  );

  const createFieldQuote = useMutation(api.quotes.createFieldQuote);
  const createQuoteWithSuppliers = useMutation(api.quotes.createQuoteWithSuppliers);

  function handleRegionChange(newRegion: RegionCode) {
    setRegionCode(newRegion);
    const meta = REGION_CONFIGS[newRegion];
    setVatRatePercent(meta.defaultVat);
    setDepositTerms(meta.defaultDeposit);
    if (newRegion === "FR") {
      setInstallationType("pose_dtu_36_5");
    } else if (newRegion === "BE") {
      setInstallationType("pose_belgique_standard");
    } else if (newRegion === "NL") {
      setInstallationType("kozijn_montage_inmeet");
    } else if (newRegion === "DE") {
      setInstallationType("ral_guetegesicherte_montage");
    } else if (newRegion === "LU") {
      setInstallationType("ral_montage_lux");
    } else {
      setInstallationType("posa_qualificata_uni_11673");
    }
  }

  // Showroom -> B2B: "Richiedi sopralluogo" leaves the configured windows in
  // sessionStorage; adopt them once instead of starting from the blank default.
  const handoffApplied = useRef(false);
  const [fromShowroom, setFromShowroom] = useState(0);
  useEffect(() => {
    if (handoffApplied.current || searchParams.get("from") !== "showroom") return;
    // Deferred one tick: applying state synchronously inside the effect body
    // cascades a render, and the guard flips inside the callback (not before)
    // so StrictMode's mount/cleanup/mount cycle can't skip the only run.
    const id = setTimeout(() => {
      if (handoffApplied.current) return;
      handoffApplied.current = true;
      const h = takeShowroomHandoff();
      if (!h) return;
    handleRegionChange(h.regionCode);
    setItems(
      h.items.map((it) => ({
        ...it,
        profileSystem: it.profileSystem ?? "standard",
        notes: it.notes ?? "",
        sashes: it.sashes.map((sash, i, all) => ({
          ...sash,
          widthRatio: sash.widthRatio ?? 1 / all.length,
          main: i === 0,
        })),
      })) as ProjectItem[],
    );
    setActiveItemIndex(0);
    setEcobonusPercent(h.isEnergyRenovation && h.regionCode === "IT" ? 50 : 0);
    setFromShowroom(h.items.length);
    }, 0);
    return () => clearTimeout(id);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // The dealer's own published catalogue is the only source of prices and choices — the
  // same one the embeddable widget uses. Without one there is nothing to price.
  const livePayload = publishedCatalog?.payload as CatalogPayload | undefined;
  const effectivePayload: CatalogPayload = livePayload ?? EMPTY_PAYLOAD;
  const usingLiveCatalog = livePayload !== undefined;
  const seedItems = useMemo(() => (livePayload ? [defaultItem(livePayload, "finestra2")] : []), [livePayload]);
  const items = itemsState ?? seedItems;
  const currentItem = items[activeItemIndex] || items[0];

  // Draft: the pieces and the client survive a reload or a dead signal on site.
  const draftKey = tenant ? `quote-new:${tenant._id}` : "quote-new";
  const [draftRestored, setDraftRestored] = useState(0);
  useDraftRestore(draftKey, usingLiveCatalog && searchParams.get("from") !== "showroom", (draft) => {
    setItems(draft.items);
    if (draft.meta.clientName) setLeadName(draft.meta.clientName);
    if (draft.meta.clientPhone) setLeadPhone(draft.meta.clientPhone);
    if (draft.meta.clientCity) setCustomerCity(draft.meta.clientCity);
    setDraftRestored(draft.items.length);
  });
  useDraftSave(draftKey, itemsState, { clientName: leadName, clientPhone: leadPhone, clientCity: customerCity });

  function updateCurrentItem(patch: Partial<ProjectItem>) {
    setItems((itemsState ?? seedItems).map((it, i) => (i === activeItemIndex ? { ...it, ...patch } : it)));
  }
  const locale = useLocale();

  const overallUw = usingLiveCatalog ? computeOverallUw(effectivePayload, items) : 0;

  // Catalog-driven regional options — the SAME rows the B2C widget renders, so a
  // DE dealer prices RC2 / Rollladen / RAL-Montage from one shared list.
  const regionOptionLists = REGION_FLAT_OPTION_KINDS.map((kind) => {
    const opts = (effectivePayload.hardware || [])
      .filter((h) => h.kind === kind && h.enabled)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((h) => ({
        key: h.key,
        label: h.labels?.[REGION_CONFIGS[regionCode].defaultLocale] || h.labels?.it || h.key,
        priceCents: h.priceCents,
      }));
    return { kind, opts };
  }).filter((x) => x.opts.length > 0);

  const priceCalc = useMemo(() => {
    const base = calculatePrice(effectivePayload, items);

    // Regional surcharges
    let regionalExtraCents = 0;
    if (regionCode === "NL") {
      regionalExtraCents += (hvlJointCount * 4500); // 45€ per HVL joint
      if (isostoneSill) regionalExtraCents += 9500; // 95€ IsoStone sill
      regionalExtraCents += (inmeetServiceCost * 100);
    } else if (regionCode === "BE") {
      if (rensonGrilleWidthMm > 0) regionalExtraCents += Math.round((rensonGrilleWidthMm / 1000) * 8500); // 85€/ml Renson
      if (voletMonoblocHeightMm > 0) regionalExtraCents += 22000; // 220€ Volet monobloc
    } else if (regionCode === "DE" || regionCode === "LU") {
      if (ralMontage) regionalExtraCents += (items.length * 4500); // 45€/window RAL kit
      if (rcSecurityLevel === "RC2") regionalExtraCents += (items.length * 6500); // 65€ RC2 upgrade
      if (rcSecurityLevel === "RC3") regionalExtraCents += (items.length * 12000); // 120€ RC3 upgrade
    }

    const installCents = installationEuros * 100;
    const demoCents = demolitionEuros * 100;
    const subtotalEx = base.priceExVatCents + installCents + demoCents + regionalExtraCents;
    const discEx = Math.round(subtotalEx * (1 - discountPercent / 100));
    const finalGross = Math.round(discEx * (1 + vatRatePercent / 100));

    // Subsidy deduction
    let subsidyDed = 0;
    if (regionCode === "IT" && ecobonusPercent > 0) {
      subsidyDed = Math.round(finalGross * (ecobonusPercent / 100));
    } else if (regionCode === "FR" && maPrimeRenovPercent > 0) {
      subsidyDed = Math.round(finalGross * (maPrimeRenovPercent / 100));
    } else if (regionCode === "LU" && klimabonusEligible) {
      subsidyDed = Math.round(finalGross * 0.20); // 20% Klimabonus
    }

    return {
      supplyExVat: base.priceExVatCents,
      installCents,
      demoCents,
      regionalExtraCents,
      subtotalEx,
      discountedExVat: discEx,
      finalGrossCents: finalGross,
      subsidyDeductionCents: subsidyDed,
      netPayableWithBonus: finalGross - subsidyDed,
    };
  }, [
    effectivePayload,
    items,
    installationEuros,
    demolitionEuros,
    discountPercent,
    vatRatePercent,
    regionCode,
    hvlJointCount,
    isostoneSill,
    inmeetServiceCost,
    rensonGrilleWidthMm,
    voletMonoblocHeightMm,
    ralMontage,
    rcSecurityLevel,
    ecobonusPercent,
    maPrimeRenovPercent,
    klimabonusEligible,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadName.trim() || !leadEmail.trim()) {
      setError("Inserisci il nome e l'email del cliente.");
      return;
    }
    if (!activeConfig) {
      setError(
        "Nessun configuratore pubblicato. Crea e pubblica un configuratore dalla pagina Configuratori: quello stesso listino verrà usato sia qui che nel widget del sito.",
      );
      return;
    }
    if (!usingLiveCatalog) {
      setError(
        "Il listino pubblicato non è ancora disponibile. Attendi il caricamento o ripubblica il configuratore.",
      );
      return;
    }

    const blocking = items.flatMap((it) => blockingIssues(pieceIssues(it, effectivePayload)));
    if (blocking.length > 0) {
      setError(t("fixPieces"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const hasSupplierItems = supplierItems.length > 0 && supplierData?.allowed === true;
      let res;

      if (hasSupplierItems) {
        const supplierLines = supplierItems.map((si, idx) => {
          const real = supplierData?.suppliers.find((sup) => sup.name === si.supplier);
          if (!real) return null;
          return {
            supplierId: real._id,
            itemIndex: Math.min(idx, items.length - 1),
            supplierPriceCents: Math.round(si.price * 100),
            leadTimeDays: real.leadTimeDays,
          };
        }).filter((line): line is NonNullable<typeof line> => line !== null);

        if (supplierLines.length === 0) {
          throw new Error("Nessun fornitore valido trovato per le righe multi-fornitore");
        }

        res = await createQuoteWithSuppliers({
          tenantId: tenant!._id,
          configuratorId: activeConfig._id,
          clientId,
          cantiereId,
          leadName: leadName.trim(),
          leadEmail: leadEmail.trim(),
          leadPhone: leadPhone.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          customerCity: customerCity.trim() || undefined,
          customerPostalCode: customerPostalCode.trim() || undefined,
          leadLocale: REGION_CONFIGS[regionCode].defaultLocale,
          leadMessage: leadMessage.trim() || undefined,
          regionCode,
          items,
          supplierLines,
          installationType,
          installationPriceCents: installationEuros * 100,
          demolitionPriceCents: demolitionEuros * 100,
          discountPercent,
          regionalSurchargeCents: priceCalc.regionalExtraCents,
          ecobonusPercent: regionCode === "IT" ? ecobonusPercent : undefined,
          poseType: regionCode === "FR" ? poseType : undefined,
          rgeCertificate: regionCode === "FR" ? rgeCertificate : undefined,
          decennaleInsurance: regionCode === "FR" ? decennaleInsurance : undefined,
          maPrimeRenovPercent: regionCode === "FR" ? maPrimeRenovPercent : undefined,
          rensonGrilleWidthMm: regionCode === "BE" && rensonGrilleWidthMm > 0 ? rensonGrilleWidthMm : undefined,
          voletMonoblocHeightMm: (regionCode === "BE" || regionCode === "DE") && voletMonoblocHeightMm > 0 ? voletMonoblocHeightMm : undefined,
          hvlJointCount: regionCode === "NL" && hvlJointCount > 0 ? hvlJointCount : undefined,
          isostoneSill: regionCode === "NL" ? isostoneSill : undefined,
          ralMontage: (regionCode === "DE" || regionCode === "LU") ? ralMontage : undefined,
          rcSecurityLevel: (regionCode === "DE" || regionCode === "LU") ? rcSecurityLevel : undefined,
          klimabonusEligible: regionCode === "LU" ? klimabonusEligible : undefined,
          profitMarginPercent,
          vatRatePercent,
          depositTerms,
        });
      } else {
        const res = await createFieldQuote({
          tenantId: tenant!._id,
          configuratorId: activeConfig._id,
          clientId,
          cantiereId,
          leadName: leadName.trim(),
          leadEmail: leadEmail.trim(),
          leadPhone: leadPhone.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          customerCity: customerCity.trim() || undefined,
          customerPostalCode: customerPostalCode.trim() || undefined,
          leadLocale: REGION_CONFIGS[regionCode].defaultLocale,
          leadMessage: leadMessage.trim() || undefined,
          regionCode,
          items,
          installationType,
          installationPriceCents: installationEuros * 100,
          demolitionPriceCents: demolitionEuros * 100,
          discountPercent,
          regionalSurchargeCents: priceCalc.regionalExtraCents,
          ecobonusPercent: regionCode === "IT" ? ecobonusPercent : undefined,
          poseType: regionCode === "FR" ? poseType : undefined,
          rgeCertificate: regionCode === "FR" ? rgeCertificate : undefined,
          decennaleInsurance: regionCode === "FR" ? decennaleInsurance : undefined,
          maPrimeRenovPercent: regionCode === "FR" ? maPrimeRenovPercent : undefined,
          rensonGrilleWidthMm: regionCode === "BE" && rensonGrilleWidthMm > 0 ? rensonGrilleWidthMm : undefined,
          voletMonoblocHeightMm: (regionCode === "BE" || regionCode === "DE") && voletMonoblocHeightMm > 0 ? voletMonoblocHeightMm : undefined,
          hvlJointCount: regionCode === "NL" && hvlJointCount > 0 ? hvlJointCount : undefined,
          isostoneSill: regionCode === "NL" ? isostoneSill : undefined,
          ralMontage: (regionCode === "DE" || regionCode === "LU") ? ralMontage : undefined,
          rcSecurityLevel: (regionCode === "DE" || regionCode === "LU") ? rcSecurityLevel : undefined,
          klimabonusEligible: regionCode === "LU" ? klimabonusEligible : undefined,
          profitMarginPercent,
          vatRatePercent,
          depositTerms,
        });
      }

      clearDraft(draftKey);
      router.push(`/app/quotes/${res!.quoteId}/sign`);
    } catch (err: unknown) {
      setError(tf(err));
    } finally {
      setSubmitting(false);
    }
  }

  const activeMeta = REGION_CONFIGS[regionCode];

  return (
    <div className="space-y-6 pb-16">
      {/* Header with Region Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[var(--color-mint)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--color-mint)] uppercase tracking-wider flex items-center gap-1.5">
              <span>{activeMeta.flag}</span>
              <span>{activeMeta.name} ({activeMeta.code})</span>
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">{activeMeta.sub}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] mt-1">
            {t("title")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/app/quotes"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          {t("cancel")}
        </Link>
      </div>

      {/* Market / Country Phase Switcher Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-[var(--color-border)]">
        {(Object.keys(REGION_CONFIGS) as RegionCode[]).map((code) => {
          const cfg = REGION_CONFIGS[code];
          const isSelected = regionCode === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => handleRegionChange(code)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold border transition-all shrink-0 ${
                isSelected
                  ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)] shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-text-secondary)]"
              }`}
            >
              <span className="text-base">{cfg.flag}</span>
              <span>{cfg.name}</span>
              <span className="text-[10px] opacity-75 font-normal">({cfg.sub.split("&")[0].trim()})</span>
            </button>
          );
        })}
      </div>

      {/* Configurator link — the price engine shared with the B2C site widget */}
      {configurators === undefined ? null : publishedConfigs.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400 space-y-2">
          <p className="font-semibold">{t("noPublishedConfig")}</p>
          <p className="text-[var(--color-text-secondary)]">
            {t("sharedCatalogHint")}
          </p>
          <Link
            href="/app/configurators"
            className="inline-flex rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-amber-950 hover:opacity-90"
          >
            {t("goToConfigurators")}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 space-y-2">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {t("configuratorLabel")}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedConfigId || publishedConfigs[0]?._id || ""}
              onChange={(e) => setSelectedConfigId(e.target.value)}
              className="flex-1 min-w-[220px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              {publishedConfigs.map((c: ConfiguratorDoc) => (
                <option key={c._id} value={c._id}>
                  {c.name} — v{c.publishedCatalogVersion ?? "?"}
                </option>
              ))}
            </select>
            {activeConfig ? (
              <Link
                href={`/app/configurators/${activeConfig._id}`}
                className="text-xs font-semibold text-[var(--color-mint)] hover:underline"
              >
                {t("editCatalog")}
              </Link>
            ) : null}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            {usingLiveCatalog
              ? t("pricesAligned")
              : t("loadingCatalog")}
          </p>
        </div>
      )}

      {error ? (
        <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Customer & Items (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer Data */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mint)] text-xs font-bold text-[var(--color-mint-dark)]">
                1
              </span>
              {t("customerSite", { country: activeMeta.name })}
            </h2>
            {fromShowroom > 0 && (
              <p className="rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] px-3 py-2 text-sm text-[var(--color-text)]" role="status">
                {t("fromShowroom", { count: fromShowroom })}
              </p>
            )}
            <ClientCantierePicker
              tenantId={tenant?._id}
              clientId={clientId}
              cantiereId={cantiereId}
              onChange={handleLinks}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("fullNameLabel")}
                </label>
                <input
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder={regionCode === "FR" ? "Ex. Jean Dubois" : regionCode === "NL" ? "Bijv. Jan de Vries" : regionCode === "DE" ? "Z.B. Thomas Müller" : "Es. Mario Rossi"}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("emailLabel")}
                </label>
                <input
                  required
                  type="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("phoneLabel")}
                </label>
                <input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="+39 / +33 / +32 / +31 / +49..."
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("addressLabel")}
                </label>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Via Roma 12 / Rue de la Paix"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("cityLabel")}
                </label>
                <input
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder={regionCode === "FR" ? "Paris / Lyon" : regionCode === "NL" ? "Amsterdam / Utrecht" : regionCode === "DE" ? "München / Berlin" : "Milano / Roma"}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("postalCodeLabel")}
                </label>
                <input
                  value={customerPostalCode}
                  onChange={(e) => setCustomerPostalCode(e.target.value)}
                  placeholder="20100 / 75001 / 1012..."
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("notesLabel")}
                </label>
                <textarea
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={t("notesPlaceholder")}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] resize-y"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Items Configuration */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mint)] text-xs font-bold text-[var(--color-mint-dark)]">
                2
              </span>
              {t("windowsMeasure", { count: items.length })}
            </h2>
            {draftRestored > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 px-3 py-2 text-xs">
                <span>{t("draftRestored", { count: draftRestored })}</span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    clearDraft(draftKey);
                    setItems(null);
                    setActiveItemIndex(0);
                    setDraftRestored(0);
                  }}
                >
                  {t("discardDraft")}
                </button>
              </div>
            ) : null}
            {usingLiveCatalog ? (
              <PiecesEditor
                payload={effectivePayload}
                locale={locale}
                items={items}
                onChange={setItems}
                activeIndex={Math.min(activeItemIndex, Math.max(0, items.length - 1))}
                onActiveChange={setActiveItemIndex}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
                {publishedCatalog === undefined && activeConfig ? t("loadingCatalog") : t("noCatalog")}
              </p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Regional Norms, Tax & Calculations (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 3: Country Specific Norms & Posa */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mint)] text-xs font-bold text-[var(--color-mint-dark)]">
                3
              </span>
              Normativa {activeMeta.name} & Cantiere
            </h2>

            <div className="space-y-3">
              {/* Region Specific Controls */}
              {regionCode === "IT" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Norma di Posa in Opera (Italia)
                    </label>
                    <select
                      value={installationType}
                      onChange={(e) => setInstallationType(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="posa_qualificata_uni_11673">UNI 11673 Posa Qualificata (Controtelaio + Nastri)</option>
                      <option value="posa_standard">Posa Standard su Telaio Esistente</option>
                      <option value="solo_fornitura">Solo Fornitura (Ritiro in sede)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Detrazione fiscale (%)
                    </label>
                    <select
                      value={ecobonusPercent}
                      onChange={(e) => setEcobonusPercent(Number(e.target.value))}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-text)] font-mono"
                    >
                      <option value={50}>50% (Bonus Casa / Ecobonus)</option>
                      <option value={36}>36% (Ordinaria)</option>
                      <option value={65}>65% (Ecobonus rafforzato)</option>
                      <option value={0}>0% (Nessuna detrazione)</option>
                    </select>
                  </div>
                </div>
              )}

              {regionCode === "FR" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Type de Pose (DTU 36.5 France)
                    </label>
                    <select
                      value={poseType}
                      onChange={(e) => setPoseType(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="pose_renovation_dormant_existant">Pose en rénovation (sur dormant existant)</option>
                      <option value="pose_feuillure">Pose en feuillure (dépose totale)</option>
                      <option value="pose_applique">Pose en applique avec doublage isolant</option>
                      <option value="pose_tunnel">Pose en tunnel</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Certificat RGE
                      </label>
                      <input
                        value={rgeCertificate}
                        onChange={(e) => setRgeCertificate(e.target.value)}
                        placeholder="RGE-2026-8849"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        MaPrimeRénov&apos; (%)
                      </label>
                      <select
                        value={maPrimeRenovPercent}
                        onChange={(e) => setMaPrimeRenovPercent(Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-text)] font-mono"
                      >
                        <option value={25}>25% (Bleu / Jaune)</option>
                        <option value={15}>15% (Violet)</option>
                        <option value={0}>0% (Non éligible)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Assurance Décennale (mention obligatoire sur le devis)
                    </label>
                    <input
                      value={decennaleInsurance}
                      onChange={(e) => setDecennaleInsurance(e.target.value)}
                      placeholder="Assurance Décennale AXA N° …"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)]"
                    />
                  </div>
                </div>
              )}

              {regionCode === "BE" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Grilles Renson (mm)
                      </label>
                      <input
                        type="number"
                        step={100}
                        value={rensonGrilleWidthMm}
                        onChange={(e) => setRensonGrilleWidthMm(Number(e.target.value))}
                        placeholder="0 = nessuna"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Volet Monobloc (mm)
                      </label>
                      <input
                        type="number"
                        step={50}
                        value={voletMonoblocHeightMm}
                        onChange={(e) => setVoletMonoblocHeightMm(Number(e.target.value))}
                        placeholder="0 = no volet"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {regionCode === "NL" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        HVL Giunzioni 90° (pz)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={16}
                        value={hvlJointCount}
                        onChange={(e) => setHvlJointCount(Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Inmeetservice (€)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={inmeetServiceCost}
                        onChange={(e) => setInmeetServiceCost(Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] font-mono"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
                    <input
                      type="checkbox"
                      checked={isostoneSill}
                      onChange={(e) => setIsostoneSill(e.target.checked)}
                      className="rounded border-[var(--color-border)] text-[var(--color-mint)]"
                    />
                    <span>IsoStone Onderdorpel (Soglia Pietra Sintetica +95€)</span>
                  </label>
                </div>
              )}

              {(regionCode === "DE" || regionCode === "LU") && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Sicherheitsstufe
                      </label>
                      <select
                        value={rcSecurityLevel}
                        onChange={(e) => setRcSecurityLevel(e.target.value)}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-text)]"
                      >
                        <option value="standard">Standard Beschlag</option>
                        <option value="RC2">RC2 (Pilzkopf + P4A)</option>
                        <option value="RC3">RC3 (Hochsicherheit)</option>
                      </select>
                    </div>
                    <div className="flex items-center pt-4">
                      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
                        <input
                          type="checkbox"
                          checked={ralMontage}
                          onChange={(e) => setRalMontage(e.target.checked)}
                          className="rounded border-[var(--color-border)] text-[var(--color-mint)]"
                        />
                        <span>RAL-Montage (+45€/pz)</span>
                      </label>
                    </div>
                  </div>
                  {regionCode === "LU" && (
                    <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={klimabonusEligible}
                        onChange={(e) => setKlimabonusEligible(e.target.checked)}
                        className="rounded border-[var(--color-border)] text-[var(--color-mint)]"
                      />
                      <span>Klimabonus éligible / Klimabonus-berechtigt (subvention −20%)</span>
                    </label>
                  )}
                </div>
              )}

              {/* Catalog-driven regional options (shared with the B2C widget) */}
              {regionOptionLists.length > 0 && currentItem && (
                <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Opzioni a listino ({activeMeta.code}) — Pos. {activeItemIndex + 1}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {regionOptionLists.map(({ kind, opts }) => (
                      <div key={kind}>
                        <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                          {REGION_OPTION_LABELS[kind] ?? kind}
                        </label>
                        <select
                          value={(currentItem[kind as keyof ProjectItem] as string) || ""}
                          onChange={(e) => updateCurrentItem({ [kind]: e.target.value } as Partial<ProjectItem>)}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-text)]"
                        >
                          <option value="">— non incluso —</option>
                          {opts.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                              {o.priceCents > 0 ? ` (+€${(o.priceCents / 100).toFixed(0)})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* General Labor & Demolition */}
              {(effectivePayload.frameTypes ?? []).length > 0 && items.some((it) => it.frameType) ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("autoInstallHint")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const auto = computeInstallation(effectivePayload, items);
                      setInstallationEuros(Math.round((auto.labourCents + auto.scaffoldCents) / 100));
                      setDemolitionEuros(Math.round(auto.disposalCents / 100));
                    }}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-mint)]"
                  >
                    {t("autoInstall")}
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border)]">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Costo Posa / Pose (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={installationEuros}
                    onChange={(e) => setInstallationEuros(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Smaltimento / Dépose (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={demolitionEuros}
                    onChange={(e) => setDemolitionEuros(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                  />
                </div>
              </div>

              {/* VAT & Discounts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Aliquota IVA / TVA / Btw
                  </label>
                  <select
                    value={vatRatePercent}
                    onChange={(e) => setVatRatePercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-text)] font-mono"
                  >
                    {activeMeta.vatOptions.map((vo) => (
                      <option key={vo.percent} value={vo.percent}>
                        {vo.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Sconto / Remise (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Margine di profitto (%) — solo interno
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={profitMarginPercent}
                    onChange={(e) => setProfitMarginPercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Materiali Multi-Fornitore (BOM) — Enterprise / Showroom only */}
          {supplierData?.allowed ? (
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">Nuovo fornitore</span>
                  <input
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    maxLength={80}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  />
                </label>
                <button
                  type="button"
                  disabled={newSupplier.trim().length < 2}
                  onClick={async () => {
                    try {
                      await createSupplier({ tenantId: tenant!._id, name: newSupplier });
                      setNewSupplier("");
                    } catch (err) {
                      setError(tf(err));
                    }
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] disabled:opacity-50"
                >
                  Aggiungi fornitore
                </button>
              </div>
              {suppliers.length > 0 ? (
                <MultiSupplierTable items={supplierItems} onItemsChange={setSupplierItems} suppliers={suppliers} />
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Aggiungi almeno un fornitore per ripartire i materiali del preventivo.
                </p>
              )}
            </section>
          ) : null}

          {/* Section 4: Live Price Summary & Direct Sign CTA */}
          <section className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider flex items-center justify-between">
              <span>{t("summary", { country: activeMeta.name })}</span>
              <span className="text-xs font-normal text-[var(--color-text-secondary)]">{activeMeta.flag}</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>{t("supplyWindows", { count: items.length })}</span>
                <span className="font-mono">€{(priceCalc.supplyExVat / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>{t("installationDisposal")}</span>
                <span className="font-mono">€{(installationEuros + demolitionEuros).toFixed(2)}</span>
              </div>
              {priceCalc.regionalExtraCents > 0 && (
                <div className="flex justify-between text-[var(--color-text-secondary)]">
                  <span>{t("regionalOptions", { code: activeMeta.code })}</span>
                  <span className="font-mono">€{(priceCalc.regionalExtraCents / 100).toFixed(2)}</span>
                </div>
              )}
              {discountPercent > 0 && (
                <div className="flex justify-between text-amber-500">
                  <span>{t("discount", { percent: discountPercent })}</span>
                  <span className="font-mono">-€{((priceCalc.subtotalEx - priceCalc.discountedExVat) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
                <span>{t("netTaxable")}</span>
                <span className="font-mono">€{(priceCalc.discountedExVat / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>{t("vat", { percent: vatRatePercent })}</span>
                <span className="font-mono">€{((priceCalc.finalGrossCents - priceCalc.discountedExVat) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[var(--color-text)] border-t border-[var(--color-border)] pt-2">
                <span>{t("totalQuote")}</span>
                <span className="text-[var(--color-mint)] font-mono">
                  €{(priceCalc.finalGrossCents / 100).toFixed(2)}
                </span>
              </div>
              {overallUw > 0 && (
                <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>{t("avgUw")}</span>
                  <span className="font-mono">{overallUw.toFixed(2)} W/m²K</span>
                </div>
              )}
              {priceCalc.subsidyDeductionCents > 0 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>
                      {regionCode === "FR" ? t("maPrimeRenov", { percent: maPrimeRenovPercent }) : regionCode === "LU" ? t("klimabonus") : t("ecobonus", { percent: ecobonusPercent })}
                    </span>
                    <span>€{(priceCalc.subsidyDeductionCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>{t("netCostClient")}</span>
                    <span>€{(priceCalc.netPayableWithBonus / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !activeConfig || !usingLiveCatalog}
              className="w-full mt-4 rounded-xl bg-[var(--color-mint)] py-3 px-4 text-center font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-base flex items-center justify-center gap-2"
            >
              {submitting
                ? t("generating")
                : !activeConfig
                  ? t("publishConfigFirst")
                  : t("proceedToSign", { country: activeMeta.name })}
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}
