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

  // Customer state
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

  // Calculation & options
  const [installationType, setInstallationType] = useState("posa_qualificata_uni_11673");
  const [installationEuros, setInstallationEuros] = useState(250);
  const [demolitionEuros, setDemolitionEuros] = useState(50);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [ecobonusPercent, setEcobonusPercent] = useState(50);
  const [profitMarginPercent, setProfitMarginPercent] = useState(30);
  const [vatRatePercent, setVatRatePercent] = useState(10); // Italian renovation standard 10%
  const [depositTerms, setDepositTerms] = useState("30% ordine · 60% merce pronta · 10% fine posa");

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

  const configIdToUse = activeConfig?._id;
  // The real published catalog — the same payload the server recomputes the
  // authoritative price from, so the live preview below cannot drift from it.
  const publishedCatalog = useQuery(
    api.configurators.getPublishedCatalog,
    configIdToUse ? { configuratorId: configIdToUse as Id<"configurators"> } : "skip",
  );

  const createFieldQuote = useMutation(api.quotes.createFieldQuote);

  const currentItem = items[activeItemIndex] || items[0];

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
      material: "pvc",
      quality: { pvc: "chamber5" },
      profileSystem: "standard",
      width: 1000,
      height: 1200,
      quantity: 1,
      sashes: [
        { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
      ],
      glazing: "double",
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

  const catalogReady = publishedCatalog?.payload != null;

  const priceCalc = useMemo(() => {
    // No published catalog yet → show zeros rather than a fabricated total.
    if (!publishedCatalog?.payload) {
      return {
        supplyExVat: 0,
        installCents: installationEuros * 100,
        demoCents: demolitionEuros * 100,
        subtotalEx: (installationEuros + demolitionEuros) * 100,
        discountedExVat: 0,
        finalGrossCents: 0,
        ecobonusDeductionCents: 0,
        netPayableWithBonus: 0,
      };
    }
    const base = calculatePrice(publishedCatalog.payload as unknown as CatalogPayload, items);
    const installCents = installationEuros * 100;
    const demoCents = demolitionEuros * 100;
    const subtotalEx = base.priceExVatCents + installCents + demoCents;
    const discEx = Math.round(subtotalEx * (1 - discountPercent / 100));
    const finalGross = Math.round(discEx * (1 + vatRatePercent / 100));
    const ecobonusDed = Math.round(finalGross * (ecobonusPercent / 100));

    return {
      supplyExVat: base.priceExVatCents,
      installCents,
      demoCents,
      subtotalEx,
      discountedExVat: discEx,
      finalGrossCents: finalGross,
      ecobonusDeductionCents: ecobonusDed,
      netPayableWithBonus: finalGross - ecobonusDed,
    };
  }, [publishedCatalog, items, installationEuros, demolitionEuros, discountPercent, ecobonusPercent, vatRatePercent]);

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
    if (!catalogReady) {
      setError("Il configuratore selezionato non ha ancora un catalogo pubblicato.");
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
        leadMessage: leadMessage.trim() || undefined,
        items,
        installationType,
        installationPriceCents: installationEuros * 100,
        demolitionPriceCents: demolitionEuros * 100,
        discountPercent,
        ecobonusPercent,
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

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[var(--color-mint)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-mint)] uppercase tracking-wider">
              Fase 21 · Italia (IT)
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">Norma UNI 11673 & Ecobonus</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] mt-1">
            Nuovo Preventivo da Cantiere (B2B Rapido)
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Genera un preventivo tecnico ufficiale in 3 minuti sul tablet/smartphone, con posa certificata e firma del cliente.
          </p>
        </div>
        <Link
          href="/app/requests"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          Annulla
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Customer & Windows items (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer Data */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mint)] text-xs font-bold text-[var(--color-mint-dark)]">
                1
              </span>
              Cliente & Cantiere
            </h2>
            {publishedConfigs.length > 1 ? (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Configuratore / Listino
                </label>
                <select
                  value={selectedConfigId || publishedConfigs[0]?._id || ""}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  {publishedConfigs.map((c: ConfiguratorDoc) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Nome e Cognome *
                </label>
                <input
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Es. Mario Rossi"
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
                  placeholder="Es. mario.rossi@email.it"
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
                  placeholder="+39 340 1234567"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Indirizzo Cantiere
                </label>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Via Roma 12"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Città
                </label>
                <input
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="Milano"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  CAP
                </label>
                <input
                  value={customerPostalCode}
                  onChange={(e) => setCustomerPostalCode(e.target.value)}
                  placeholder="20100"
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
                      ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] text-[var(--color-mint)]"
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
                      <option value="window">Finestra</option>
                      <option value="balconyDoor">Portafinestra</option>
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
                      <option value="double">Doppio Basso Emissivo (Ug 1.1)</option>
                      <option value="triple">Triplo Vetro Termico (Ug 0.6)</option>
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
                      <option value="white">Bianco Massa RAL 9016</option>
                      <option value="anthracite">Grigio Antracite RAL 7016</option>
                      <option value="woodgrain">Effetto Legno Noce/Rovere</option>
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

        {/* RIGHT COLUMN: Posa UNI 11673, Ecobonus, Margins & Totals (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 3: Italian Regulation & Labor */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mint)] text-xs font-bold text-[var(--color-mint-dark)]">
                3
              </span>
              Posa UNI 11673, Fisco & Margini
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Norma di Posa in Opera
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Costo Posa (€)
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

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Sconto (%)
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
                    Ecobonus (%)
                  </label>
                  <select
                    value={ecobonusPercent}
                    onChange={(e) => setEcobonusPercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-sm text-[var(--color-text)] font-mono"
                  >
                    <option value={50}>50%</option>
                    <option value={36}>36%</option>
                    <option value={65}>65%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Aliquota IVA
                  </label>
                  <select
                    value={vatRatePercent}
                    onChange={(e) => setVatRatePercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-sm text-[var(--color-text)] font-mono"
                  >
                    <option value={10}>10% (Ristr.)</option>
                    <option value={22}>22% (Ord.)</option>
                    <option value={4}>4% (Prima casa)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Margine interno (%) — non mostrato al cliente
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={profitMarginPercent}
                  onChange={(e) => setProfitMarginPercent(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Condizioni di pagamento
                </label>
                <input
                  value={depositTerms}
                  onChange={(e) => setDepositTerms(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Note per il cliente (facoltative)
                </label>
                <textarea
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                  rows={2}
                  placeholder="Es. tempi di consegna, dettagli sopralluogo…"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Live Price Summary & Direct Sign CTA */}
          <section className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">
              Riepilogo Economico
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Fornitura Serramenti ({items.length} pz):</span>
                <span className="font-mono">€{(priceCalc.supplyExVat / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Posa qualificata + Smaltimento:</span>
                <span className="font-mono">€{(installationEuros + demolitionEuros).toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-amber-500">
                  <span>Sconto Cantiere ({discountPercent}%):</span>
                  <span className="font-mono">-€{((priceCalc.subtotalEx - priceCalc.discountedExVat) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
                <span>Imponibile netto:</span>
                <span className="font-mono">€{(priceCalc.discountedExVat / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>IVA ({vatRatePercent}%):</span>
                <span className="font-mono">€{((priceCalc.finalGrossCents - priceCalc.discountedExVat) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[var(--color-text)] border-t border-[var(--color-border)] pt-2">
                <span>Totale Preventivo:</span>
                <span className="text-[var(--color-mint)] font-mono">
                  €{(priceCalc.finalGrossCents / 100).toFixed(2)}
                </span>
              </div>
              {ecobonusPercent > 0 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Detrazione Ecobonus ({ecobonusPercent}%):</span>
                    <span>€{(priceCalc.ecobonusDeductionCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>Costo effettivo per il cliente:</span>
                    <span>€{(priceCalc.netPayableWithBonus / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !catalogReady}
              className="w-full mt-4 rounded-xl bg-[var(--color-mint)] py-3 px-4 text-center font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity text-base flex items-center justify-center gap-2"
            >
              {submitting ? "Generazione in corso..." : "Procedi alla Firma Touch"}
            </button>
            {!catalogReady && configIdToUse ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center">
                Pubblica il catalogo del configuratore per generare preventivi.
              </p>
            ) : null}
          </section>
        </div>
      </form>
    </div>
  );
}
