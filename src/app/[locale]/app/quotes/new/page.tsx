"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { SpecDrawing } from "@/components/widget/spec-drawing";
import { calculatePrice, type ProjectItem, type CatalogPayload } from "@/shared/pricing";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Material } from "@/components/widget/widget-pricing";

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
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(
    api.configurators.listConfigurators,
    tenant ? { tenantId: tenant._id } : "skip",
  );

  const publishedConfigs = useMemo(
    () => (configurators ?? []).filter((c: ConfiguratorDoc) => c.status === "published"),
    [configurators],
  );

  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [regionCode, setRegionCode] = useState<RegionCode>("IT");

  // Customer state
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

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

  // Items state (start with 1 standard window)
  const [items, setItems] = useState<ProjectItem[]>([
    {
      productType: "window",
      material: "pvc",
      quality: { pvc: "chamber5" },
      profileSystem: "standard",
      width: 1200,
      height: 1400,
      quantity: 1,
      sashes: [
        { type: "fix", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
        { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
      ],
      glazing: "double",
      color: "white",
      insectScreen: false,
    },
  ]);

  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeConfig = publishedConfigs.find(
    (c: ConfiguratorDoc) => c._id === (selectedConfigId || publishedConfigs[0]?._id),
  );

  const createFieldQuote = useMutation(api.quotes.createFieldQuote);

  const currentItem = items[activeItemIndex] || items[0];

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

  function updateCurrentItem(patch: Partial<ProjectItem>) {
    setItems((prev) => {
      const next = [...prev];
      next[activeItemIndex] = { ...next[activeItemIndex], ...patch };
      return next;
    });
  }

  function addItem() {
    const newItem: ProjectItem = {
      productType: "window",
      material: currentItem.material || "pvc",
      quality: { pvc: "chamber5" },
      profileSystem: "standard",
      width: 1000,
      height: 1200,
      quantity: 1,
      sashes: [
        { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
      ],
      glazing: regionCode === "DE" ? "triple" : "double",
      color: "white",
      insectScreen: false,
    };
    setItems((prev) => [...prev, newItem]);
    setActiveItemIndex(items.length);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setActiveItemIndex(Math.max(0, index - 1));
  }

  // Live price calculation
  const mockPayload: CatalogPayload = {
    configurator: {
      publicId: activeConfig?.publicId || "draft",
      name: activeConfig?.name || "Configuratore",
      defaultLocale: REGION_CONFIGS[regionCode].defaultLocale,
      defaultTheme: "auto",
      vatRatePercent,
      priceRoundingStep: 1,
      showPricesToEndUser: true,
      currency: "EUR",
    },
    branding: {
      whiteLabel: true,
      colorAccent: "#16d19d",
      colorAccentInk: "#042f24",
      fontFamily: "geist",
      copy: {},
      companyInfo: { name: tenant?.name || "Serramenti" },
    },
    materials: [
      { key: "pvc", labels: { it: "PVC Alta Densità", fr: "PVC Haute Densité", de: "PVC Kunststoff", nl: "PVC Kunststof" }, basePerM2Cents: 18000, profilePerMlCents: 2800, sortOrder: 1, enabled: true },
      { key: "alu", labels: { it: "Alluminio Taglio Termico", fr: "Aluminium Rupture Thermique", de: "Aluminium Thermisch getrennt", nl: "Aluminium Thermisch onderbroken" }, basePerM2Cents: 26000, profilePerMlCents: 3800, sortOrder: 2, enabled: true },
      { key: "wood", labels: { it: "Legno Massello Lamellare", fr: "Bois Lamellé Collé", de: "Holz Lamelliert", nl: "Hout Gelamineerd" }, basePerM2Cents: 32000, profilePerMlCents: 4500, sortOrder: 3, enabled: true },
    ],
    qualityTiers: [
      { materialKey: "pvc", key: "chamber5", labels: { it: "70mm 5 Camere", fr: "70mm 5 Chambres", de: "70mm 5-Kammer", nl: "70mm 5-Kamer" }, multiplier: 1.0, uAdjust: 0, sortOrder: 1, enabled: true },
      { materialKey: "pvc", key: "chamber7", labels: { it: "82mm 7 Camere Triplo Vetro", fr: "82mm 7 Chambres Triple Vitrage", de: "82mm 7-Kammer 3-fach", nl: "82mm 7-Kamer Drievoudig" }, multiplier: 1.35, uAdjust: -0.3, sortOrder: 2, enabled: true },
      { materialKey: "alu", key: "standard", labels: { it: "Taglio Termico 65mm", fr: "Rupture Thermique 65mm", de: "Thermoschnitt 65mm", nl: "Thermische Onderbreking 65mm" }, multiplier: 1.0, uAdjust: 0, sortOrder: 1, enabled: true },
      { materialKey: "wood", key: "standard", labels: { it: "Legno Lamellare 68mm", fr: "Bois 68mm", de: "Holz 68mm", nl: "Hout 68mm" }, multiplier: 1.0, uAdjust: 0, sortOrder: 1, enabled: true },
    ],
    profileSystems: [
      { materialKey: "pvc", key: "standard", labels: { it: "Standard", fr: "Standard", de: "Standard", nl: "Standaard" }, multiplier: 1.0, sortOrder: 1, enabled: true },
      { materialKey: "pvc", key: "premium", labels: { it: "Schüco / Aluplast / Kömmerling", fr: "Schüco / Aluplast", de: "Schüco / Aluplast / Kömmerling", nl: "K-Vision / Gealan" }, multiplier: 1.25, sortOrder: 2, enabled: true },
    ],
    sizeConstraints: [],
    glazing: [
      { key: "double", labels: { it: "Doppio Vetro Basso Emissivo (Ug 1.1)", fr: "Double Vitrage FE (Ug 1.1)", de: "2-fach Isolierglas (Ug 1.1)", nl: "HR++ Dubbel Glas (Ug 1.1)" }, priceCents: 0, uGlass: 1.1, sortOrder: 1, enabled: true },
      { key: "triple", labels: { it: "Triplo Vetro Termico (Ug 0.6)", fr: "Triple Vitrage Thermique (Ug 0.6)", de: "3-fach Wärmeschutzglas (Ug 0.6)", nl: "HR+++ Drievoudig Glas (Ug 0.6)" }, priceCents: 6500, uGlass: 0.6, sortOrder: 2, enabled: true },
    ],
    finish: [
      { key: "white", labels: { it: "Bianco Massa RAL 9016", fr: "Blanc Masse RAL 9016", de: "Verkehrsweiß RAL 9016", nl: "Crèmewit / Wit RAL 9001/9016" }, priceCents: 0, swatchHex: "#ffffff", sortOrder: 1, enabled: true },
      { key: "anthracite", labels: { it: "Grigio Antracite RAL 7016", fr: "Gris Anthracite RAL 7016", de: "Anthrazitgrau RAL 7016", nl: "Antraciet RAL 7016" }, priceCents: 3500, swatchHex: "#373e48", sortOrder: 2, enabled: true },
      { key: "woodgrain", labels: { it: "Noce / Rovere", fr: "Chêne Doré / Noyer", de: "Golden Oak / Nussbaum", nl: "Monumentengroen / Houtnerf RAL 6009" }, priceCents: 5500, swatchHex: "#6d4c41", sortOrder: 3, enabled: true },
    ],
    hardware: [
      { kind: "sashType", key: "fix", labels: { it: "Fisso", fr: "Fixe", de: "Festverglasung", nl: "Vast glas" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 1, enabled: true },
      { kind: "sashType", key: "tiltturn", labels: { it: "Antaribalta (Vasistas)", fr: "Oscillo-battant", de: "Dreh-Kipp", nl: "Draai-kiep" }, priceCents: 4500, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
      { kind: "sashType", key: "classic", labels: { it: "Battente", fr: "Ouvrant à la française", de: "Drehflügel", nl: "Draaivleugel" }, priceCents: 2000, appliesToOperableOnly: true, sortOrder: 3, enabled: true },
      { kind: "hardware", key: "maco", labels: { it: "Maco / Siegenia / Winkhaus" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
      { kind: "hardwareColor", key: "white", labels: { it: "Standard" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
      { kind: "screen", key: "molla", labels: { it: "Zanzariera", fr: "Moustiquaire", de: "Insektenschutz", nl: "Hor" }, priceCents: 7500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    ],
  };

  const priceCalc = useMemo(() => {
    const base = calculatePrice(mockPayload, items);

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
      setError("Nessun configuratore pubblicato trovato.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await createFieldQuote({
        tenantId: tenant!._id,
        configuratorId: activeConfig._id,
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

      router.push(`/app/quotes/${res.quoteId}/sign`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore durante la creazione del preventivo");
    } finally {
      setSubmitting(false);
    }
  }

  const activeMeta = REGION_CONFIGS[regionCode];

  return (
    <div className="space-y-6 max-w-6xl pb-16">
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
            Preventivatore Rapido B2B (Cantiere / Tablet)
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Genera un preventivo tecnico ufficiale in 3 minuti con disegno quotato, posa certificata e firma del cliente.
          </p>
        </div>
        <Link
          href="/app/quotes"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          Annulla
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
                  ? "border-[var(--color-mint)] bg-[var(--color-mint)]/10 text-[var(--color-mint)] shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className="text-base">{cfg.flag}</span>
              <span>{cfg.name}</span>
              <span className="text-[10px] opacity-75 font-normal">({cfg.sub.split("&")[0].trim()})</span>
            </button>
          );
        })}
      </div>

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
              Cliente & Cantiere ({activeMeta.name})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Nome e Cognome / Client *
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
                  Email *
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
                  Telefono (WhatsApp)
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
                  Indirizzo / Adresse Cantiere
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
                  Città / Ville / Stad
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
                  CAP / Code Postal / Postcode
                </label>
                <input
                  value={customerPostalCode}
                  onChange={(e) => setCustomerPostalCode(e.target.value)}
                  placeholder="20100 / 75001 / 1012..."
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Items Configuration */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mint)] text-xs font-bold text-[var(--color-mint-dark)]">
                  2
                </span>
                Serramenti & Rilievo Misure ({items.length})
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg bg-[var(--color-mint)] px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)] hover:opacity-90 transition-opacity"
              >
                + Aggiungi Infisso
              </button>
            </div>

            {/* Item Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((it, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveItemIndex(idx)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors shrink-0 ${
                    activeItemIndex === idx
                      ? "border-[var(--color-mint)] bg-[var(--color-mint)]/10 text-[var(--color-mint)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span>Pos. {idx + 1}: {it.productType === "balconyDoor" ? "Porta" : "Finestra"} ({it.width}×{it.height})</span>
                  {items.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(idx);
                      }}
                      className="hover:text-[var(--color-danger)] text-base leading-none"
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Active Item Configuration */}
            {currentItem && (
              <div className="space-y-4 pt-2 border-t border-[var(--color-border)]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Tipologia
                    </label>
                    <select
                      value={currentItem.productType}
                      onChange={(e) => updateCurrentItem({ productType: e.target.value as "window" | "balconyDoor" })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="window">Finestra / Fenêtre / Fenster / Raam</option>
                      <option value="balconyDoor">Portafinestra / Porte-fenêtre / Balkontür</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Larghezza (mm)
                    </label>
                    <input
                      type="number"
                      step={10}
                      min={400}
                      max={4000}
                      value={currentItem.width}
                      onChange={(e) => updateCurrentItem({ width: Number(e.target.value) })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Altezza (mm)
                    </label>
                    <input
                      type="number"
                      step={10}
                      min={400}
                      max={3000}
                      value={currentItem.height}
                      onChange={(e) => updateCurrentItem({ height: Number(e.target.value) })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Materiale
                    </label>
                    <select
                      value={currentItem.material}
                      onChange={(e) => updateCurrentItem({ material: e.target.value })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="pvc">PVC Alta Densità</option>
                      <option value="alu">Alluminio Taglio Termico</option>
                      <option value="wood">Legno Lamellare</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Vetro Isolante
                    </label>
                    <select
                      value={currentItem.glazing}
                      onChange={(e) => updateCurrentItem({ glazing: e.target.value })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="double">Doppio / Double / HR++ (Ug 1.1)</option>
                      <option value="triple">Triplo / Triple / 3-fach / HR+++ (Ug 0.6)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      Colore / Finitura
                    </label>
                    <select
                      value={currentItem.color}
                      onChange={(e) => updateCurrentItem({ color: e.target.value })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                    >
                      <option value="white">Bianco / Blanc / Weiß / Crème (RAL 9016/9001)</option>
                      <option value="anthracite">Grigio Antracite RAL 7016</option>
                      <option value="woodgrain">{regionCode === "NL" ? "Monumentengroen RAL 6009 Houtnerf" : "Effetto Legno Noce/Rovere"}</option>
                    </select>
                  </div>
                </div>

                {/* 2D Vector Blueprint Preview */}
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col items-center">
                  <div className="w-full max-w-[280px] h-[220px]">
                    <SpecDrawing
                      material={(currentItem.material === "alu" ? "aluminum" : currentItem.material) as Material}
                      width={currentItem.width}
                      height={currentItem.height}
                      sashes={currentItem.sashes as import("@/components/widget/widget-pricing").Sash[]}
                      selected={null}
                      interactive={false}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)] mt-2">
                    Disegno quotato in scala · {currentItem.width} × {currentItem.height} mm
                  </span>
                </div>
              </div>
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
                </div>
              )}

              {/* General Labor & Demolition */}
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
              </div>
            </div>
          </section>

          {/* Section 4: Live Price Summary & Direct Sign CTA */}
          <section className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider flex items-center justify-between">
              <span>Riepilogo {activeMeta.name}</span>
              <span className="text-xs font-normal text-[var(--color-text-secondary)]">{activeMeta.flag}</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Fornitura Infissi ({items.length} pz):</span>
                <span className="font-mono">€{(priceCalc.supplyExVat / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Posa + Smaltimento:</span>
                <span className="font-mono">€{(installationEuros + demolitionEuros).toFixed(2)}</span>
              </div>
              {priceCalc.regionalExtraCents > 0 && (
                <div className="flex justify-between text-[var(--color-text-secondary)]">
                  <span>Opzioni Regionali ({activeMeta.code}):</span>
                  <span className="font-mono">€{(priceCalc.regionalExtraCents / 100).toFixed(2)}</span>
                </div>
              )}
              {discountPercent > 0 && (
                <div className="flex justify-between text-amber-500">
                  <span>Sconto ({discountPercent}%):</span>
                  <span className="font-mono">-€{((priceCalc.subtotalEx - priceCalc.discountedExVat) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
                <span>Imponibile Netto:</span>
                <span className="font-mono">€{(priceCalc.discountedExVat / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>IVA / TVA / Btw ({vatRatePercent}%):</span>
                <span className="font-mono">€{((priceCalc.finalGrossCents - priceCalc.discountedExVat) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[var(--color-text)] border-t border-[var(--color-border)] pt-2">
                <span>Totale Preventivo:</span>
                <span className="text-[var(--color-mint)] font-mono">
                  €{(priceCalc.finalGrossCents / 100).toFixed(2)}
                </span>
              </div>
              {priceCalc.subsidyDeductionCents > 0 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>
                      {regionCode === "FR" ? `MaPrimeRénov' (${maPrimeRenovPercent}%):` : regionCode === "LU" ? "Klimabonus Subvention (20%):" : `Detrazione Ecobonus (${ecobonusPercent}%):`}
                    </span>
                    <span>€{(priceCalc.subsidyDeductionCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>Costo netto per il cliente:</span>
                    <span>€{(priceCalc.netPayableWithBonus / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 rounded-xl bg-[var(--color-mint)] py-3 px-4 text-center font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity text-base flex items-center justify-center gap-2"
            >
              {submitting ? "Generazione in corso..." : `Procedi alla Firma Touch (${activeMeta.name}) ✍️`}
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}
