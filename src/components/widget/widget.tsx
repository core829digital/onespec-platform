"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SpecDrawing } from "./spec-drawing";
import { getDict, LOCALE_CFG, labelFromList } from "./widget-i18n";
import { readableInk, isSafeColor, resolveFontStack } from "./widget-theme";
import { postToHost, readHostTheme } from "./host-bridge";
import {
  defaultConfig,
  defaultPricing,
  defaultSashPreset,
  defaultDimsForType,
  calculate,
  computeUw,
  clamp,
  dimMin,
  dimMax,
  SINGLE_SASH_MAX_WIDTH,
  SINGLE_SASH_MAX_HEIGHT,
  QTY_MIN,
  QTY_MAX,
  SASH_MIN,
  SASH_MAX,
  type ConfigState,
  type Material,
  type Sash,
  type SashType,
  type Direction,
} from "./widget-pricing";

interface WidgetProps {
  configurator: {
    publicId: string;
    name: string;
    currency?: string;
    vatRatePercent?: number;
    showPricesToEndUser?: boolean;
    branding?: {
      colorAccent?: string;
      colorAccentInk?: string | null;
      fontFamily?: string;
      companyInfo?: { name?: string };
      logoUrl?: string | null;
      logoLightUrl?: string | null;
    };
  };
  theme: string;
  lang: string;
  preview: boolean;
  /** Host-site accent from the embed snippet (?accent=). */
  accentOverride?: string;
  /** Host-site font from the embed snippet (?font=). */
  fontOverride?: string;
}

interface HostTheme {
  accent?: string;
  bg?: string;
  font?: string;
}

interface SavedItem extends ConfigState {
  unitPrice: number;
  totalPrice: number;
}

const CONVEX_SITE =
  (process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string) ||
  (process.env.NEXT_PUBLIC_CONVEX_URL as string)?.replace(".convex.cloud", ".convex.site") ||
  "";

export function Widget({
  configurator,
  theme,
  lang,
  preview,
  accentOverride,
  fontOverride,
}: WidgetProps) {
  const dict = getDict(lang);
  const cfg = LOCALE_CFG[lang] ?? LOCALE_CFG.en;
  const submitLocale = (["it", "en", "fr"].includes(lang) ? lang : "it") as "it" | "en" | "fr";

  const initialVat =
    typeof configurator.vatRatePercent === "number" ? configurator.vatRatePercent : 22;
  const [vatPct, setVatPct] = useState(initialVat);

  // Pricing catalogue for the LIVE PREVIEW. The authoritative price is always
  // recomputed on the server; VAT is the one field the visitor can tweak.
  const pricing = useMemo(() => {
    const p = defaultPricing();
    p.vatRate = vatPct;
    return p;
  }, [vatPct]);

  const showPrices = configurator.showPricesToEndUser !== false;

  // Host-page theme pushed via postMessage after mount (see the embed snippet).
  const [hostTheme, setHostTheme] = useState<HostTheme>({});

  // Accent precedence: postMessage from host > ?accent= > tenant branding > default.
  const accent = useMemo(() => {
    const candidates = [hostTheme.accent, accentOverride, configurator.branding?.colorAccent, "#16d19d"];
    return candidates.find((c) => isSafeColor(c)) ?? "#16d19d";
  }, [hostTheme.accent, accentOverride, configurator.branding?.colorAccent]);

  // Ink is explicit-or-auto: use the tenant's configured ink if any, else derive
  // a readable colour from the resolved accent (WCAG luminance).
  const accentInk = useMemo(() => {
    const configured = configurator.branding?.colorAccentInk;
    return isSafeColor(configured) ? (configured as string) : readableInk(accent);
  }, [configurator.branding?.colorAccentInk, accent]);

  const fontStack = useMemo(
    () => resolveFontStack(hostTheme.font || fontOverride || configurator.branding?.fontFamily),
    [hostTheme.font, fontOverride, configurator.branding?.fontFamily],
  );

  const [state, setState] = useState<ConfigState>(() => defaultConfig());
  const [items, setItems] = useState<SavedItem[]>([]);
  const [selectedSash, setSelectedSash] = useState<number | null>(null);
  const [ecobonusOpen, setEcobonusOpen] = useState(false);
  const [ecobonusPct, setEcobonusPct] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);

  const [step, setStep] = useState<"config" | "lead" | "success">("config");
  const [lead, setLead] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // ---- theme ----
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  }, [theme]);

  // Push resolved accent / ink / font onto the scoped CSS vars so widget.css
  // (focus rings, links, hover) and inline styles stay in sync.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".tw-widget-root") ?? document.documentElement;
    root.style.setProperty("--tw-accent", accent);
    root.style.setProperty("--tw-accent-ink", accentInk);
    root.style.setProperty("--tw-font", fontStack);
  }, [accent, accentInk, fontStack]);

  // ---- iframe resize + host-theme protocol ----
  useEffect(() => {
    function post() {
      postToHost({
        type: "onespec:resize",
        publicId: configurator.publicId,
        height: document.body.scrollHeight,
      });
    }
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    postToHost({ type: "onespec:ready", publicId: configurator.publicId });

    function onMessage(e: MessageEvent) {
      const theme = readHostTheme(e);
      if (theme) setHostTheme(theme);
    }
    window.addEventListener("message", onMessage);
    return () => {
      ro.disconnect();
      window.removeEventListener("message", onMessage);
    };
  }, [configurator.publicId]);

  // ---- derived ----
  const result = useMemo(() => calculate(state, pricing), [state, pricing]);
  const uw = useMemo(() => computeUw(state), [state]);

  const itemsSubtotal = items.reduce((s, it) => s + it.totalPrice, 0);
  const grossGrand = itemsSubtotal + result.totalPrice;
  const ecobonusAmount = grossGrand * (ecobonusPct / 100);
  const discountAmount = grossGrand * (discountPct / 100);
  const finalGrand = grossGrand - ecobonusAmount - discountAmount;

  const fmtC = useCallback(
    (v: number) => {
      try {
        return new Intl.NumberFormat(cfg.locale, { style: "currency", currency: cfg.currency, maximumFractionDigits: 2 }).format(v);
      } catch {
        return "€" + v.toFixed(2);
      }
    },
    [cfg.locale, cfg.currency],
  );
  const fmtN = useCallback(
    (v: number, d: number) => {
      try {
        return new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
      } catch {
        return v.toFixed(d);
      }
    },
    [cfg.locale],
  );

  // ---- mutators ----
  const set = (patch: Partial<ConfigState>) => setState((s) => ({ ...s, ...patch }));

  const setSash = (i: number, patch: Partial<Sash>) =>
    setState((s) => {
      const sashes = s.sashes.map((sash, idx) => (idx === i ? { ...sash, ...patch } : sash));
      return { ...s, sashes };
    });

  const setSashCount = (raw: number) => {
    const n = clamp(Math.round(raw), SASH_MIN, SASH_MAX);
    setState((s) => {
      let sashes = s.sashes.slice();
      if (n > sashes.length) {
        for (let i = sashes.length; i < n; i++) {
          sashes.push({ type: "tiltturn", direction: i % 2 === 0 ? "right" : "left", active: true, hardware: "maco", hardwareColor: "white" });
        }
      } else if (n < sashes.length) {
        sashes = sashes.slice(0, n);
      }
      let width = s.width;
      let height = s.height;
      if (n === 1) {
        width = clamp(width, dimMin(s, "width"), SINGLE_SASH_MAX_WIDTH);
        height = clamp(height, dimMin(s, "height"), SINGLE_SASH_MAX_HEIGHT);
      }
      return { ...s, sashes, width, height };
    });
    setSelectedSash((sel) => (sel !== null && sel >= n ? null : sel));
  };

  const changeProductType = (pt: "window" | "balconyDoor") => {
    const d = defaultDimsForType(pt);
    setState((s) => ({ ...s, productType: pt, width: d.width, height: d.height, sashes: defaultSashPreset() }));
    setSelectedSash(null);
  };

  const changeMaterial = (m: Material) => set({ material: m });

  const addAnother = () => {
    setItems((prev) => [...prev, { ...state, unitPrice: result.unitPrice, totalPrice: result.totalPrice }]);
    setState(defaultConfig());
    setSelectedSash(null);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // ---- submit ----
  function buildSpecSummary(all: ConfigState[]): string {
    const lines = all.map((it, i) => {
      const mat = it.material === "pvc" ? dict.materialPVC : it.material === "wood" ? dict.materialWood : dict.materialAluminum;
      const pt = it.productType === "balconyDoor" ? dict.productTypeDoor : dict.productTypeWindow;
      const q = labelFromList(dict.quality[it.material], it.quality[it.material]);
      const brand =
        it.material === "pvc" || it.material === "aluminum"
          ? labelFromList(dict.brands[it.material], it.brand[it.material])
          : "";
      const glz = labelFromList(dict.glazing, it.glazing);
      const col = labelFromList(dict.color, it.color);
      const inst = labelFromList(dict.installationOptions, it.installation);
      const sashDesc = it.sashes
        .map(
          (s, si) =>
            `${si + 1}:${labelFromList(dict.sashTypes, s.type)}/${labelFromList(dict.directions, s.direction)}${s.active ? "" : "(off)"}`,
        )
        .join(", ");
      const screen = it.insectScreen
        ? ` | ${dict.insectScreenLabel}: ${labelFromList(dict.insectScreenTypes, it.insectScreenType)} / ${labelFromList(dict.insectScreenColors, it.insectScreenColor)}`
        : "";
      return `${i + 1}. ${pt} ${mat}${brand ? ` (${brand})` : ""} ${it.width}×${it.height}mm ×${it.quantity} | ${q}, ${glz}, ${col}, ${inst} | ${dict.sashLabel}: ${sashDesc}${screen}`;
    });
    if (ecobonusPct > 0) lines.push(`Ecobonus: -${ecobonusPct}%`);
    if (discountPct > 0) lines.push(`${dict.discountLabel}: -${discountPct}%`);
    return lines.join("\n");
  }

  function toSubmitItem(it: ConfigState) {
    return {
      productType: it.productType,
      material: it.material,
      quality: it.quality,
      width: Math.round(it.width),
      height: Math.round(it.height),
      quantity: it.quantity,
      sashes: it.sashes.map((s) => ({
        type: s.type,
        direction: s.direction,
        active: s.active,
        hardware: s.hardware,
        hardwareColor: s.hardwareColor,
      })),
      glazing: it.glazing,
      color: it.color,
      insectScreen: it.insectScreen,
    };
  }

  async function submit() {
    setError("");
    if (!lead.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
      setError(dict.leadError);
      return;
    }
    setSubmitting(true);
    try {
      const all = [...items, state];
      const userMsg = lead.message.trim();
      const spec = buildSpecSummary(all);
      const body = {
        publicId: configurator.publicId,
        items: all.map(toSubmitItem),
        leadName: lead.name.trim(),
        leadEmail: lead.email.trim(),
        leadPhone: lead.phone.trim() || undefined,
        leadCompany: lead.company.trim() || undefined,
        leadMessage: [userMsg, "--- spec ---", spec].filter(Boolean).join("\n").slice(0, 2000),
        leadLocale: submitLocale,
        honeypot: honeypot || undefined,
        clientReportedPriceCents: Math.round(finalGrand * 100),
      };
      const res = await fetch(`${CONVEX_SITE}/api/widget/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "BAD_RESPONSE" }));
      if (res.ok && data.ok) {
        setStep("success");
        postToHost({ type: "onespec:submitted", publicId: configurator.publicId });
      } else {
        setError(typeof data.error === "string" ? data.error : "SUBMIT_FAILED");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "NETWORK_ERROR");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- styles (scoped, brand-token driven) ----
  const s = STYLES;

  if (step === "success") {
    return (
      <div style={s.wrap}>
        <div style={{ ...s.panel, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
          <h2 style={{ margin: "0 0 8px", color: "var(--color-text)" }}>{dict.successTitle}</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>{dict.successBody}</p>
        </div>
      </div>
    );
  }

  const materialTabs: { key: Material; label: string; swatch: string }[] = [
    { key: "pvc", label: dict.materialPVC, swatch: "#DCEAF0" },
    { key: "wood", label: dict.materialWood, swatch: "#F1E4D2" },
    { key: "aluminum", label: dict.materialAluminum, swatch: "#E6E9EA" },
  ];

  const hasBrand = state.material === "pvc" || state.material === "aluminum";

  return (
    <div style={s.wrap}>
      {/* header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {configurator.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={configurator.branding.logoUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }} />
          ) : (
            <div style={s.brandMark}>W/D</div>
          )}
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: "var(--color-text)" }}>
              {configurator.name || dict.brandName}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>{dict.tagline}</p>
          </div>
        </div>
      </div>

      {/* material tabs */}
      <div style={s.materials}>
        {materialTabs.map((m) => {
          const active = state.material === m.key;
          return (
            <button
              key={m.key}
              type="button"
              data-tw-tab
              onClick={() => changeMaterial(m.key)}
              style={{ ...s.materialTab, ...(active ? { borderColor: accent, background: "var(--color-mint-light)" } : {}) }}
            >
              <span style={{ ...s.swatch, background: m.swatch, ...(active ? { boxShadow: `0 0 0 2px ${accent}` } : {}) }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text)" }}>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div style={s.grid} data-tw-grid>
        {/* LEFT: form */}
        <div style={s.panel}>
          <h2 style={s.h2}>{dict.configTitle}</h2>

          <Field label={dict.productTypeLabel}>
            <div style={{ display: "flex", gap: 8 }}>
              {(["window", "balconyDoor"] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  data-tw-tab
                  onClick={() => changeProductType(pt)}
                  style={{
                    ...s.typeBtn,
                    ...(state.productType === pt ? { borderColor: accent, background: "var(--color-mint-light)", color: accent } : {}),
                  }}
                >
                  {pt === "window" ? dict.productTypeWindow : dict.productTypeDoor}
                </button>
              ))}
            </div>
            {state.productType === "balconyDoor" && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: accent, fontWeight: 600 }}>{dict.thresholdNote}</div>
            )}
          </Field>

          <Field label={dict.qualityLabel}>
            <select style={s.select} value={state.quality[state.material]} onChange={(e) => set({ quality: { ...state.quality, [state.material]: e.target.value } })}>
              {dict.quality[state.material].map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          {hasBrand && (
            <Field label={dict.brandLabel}>
              <select
                style={s.select}
                value={state.brand[state.material as "pvc" | "aluminum"]}
                onChange={(e) => set({ brand: { ...state.brand, [state.material]: e.target.value } })}
              >
                {dict.brands[state.material].map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div style={s.row}>
            <Field label={dict.widthLabel}>
              <input
                style={s.input}
                type="number"
                inputMode="numeric"
                value={state.width}
                min={dimMin(state, "width")}
                max={dimMax(state, "width")}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n > 0) set({ width: n });
                }}
                onBlur={(e) => set({ width: clamp(parseFloat(e.target.value), dimMin(state, "width"), dimMax(state, "width")) })}
              />
            </Field>
            <Field label={dict.heightLabel}>
              <input
                style={s.input}
                type="number"
                inputMode="numeric"
                value={state.height}
                min={dimMin(state, "height")}
                max={dimMax(state, "height")}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n > 0) set({ height: n });
                }}
                onBlur={(e) => set({ height: clamp(parseFloat(e.target.value), dimMin(state, "height"), dimMax(state, "height")) })}
              />
            </Field>
          </div>

          <div style={s.row}>
            <Field label={dict.quantityLabel}>
              <input
                style={s.input}
                type="number"
                inputMode="numeric"
                value={state.quantity}
                min={QTY_MIN}
                max={QTY_MAX}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n > 0) set({ quantity: Math.round(n) });
                }}
                onBlur={(e) => set({ quantity: clamp(Math.round(parseFloat(e.target.value)), QTY_MIN, QTY_MAX) })}
              />
            </Field>
            <Field label={dict.sashCountLabel}>
              <input
                style={s.input}
                type="number"
                inputMode="numeric"
                value={state.sashes.length}
                min={SASH_MIN}
                max={SASH_MAX}
                onChange={(e) => setSashCount(parseFloat(e.target.value))}
              />
            </Field>
          </div>
          <div style={s.hint}>{dict.sashCountHint}</div>
          <div style={s.hint}>{dict.viewNote}</div>
          {state.sashes.length === 1 && (
            <div style={{ ...s.hint, color: accent, fontWeight: 600 }}>{dict.singleSashCapHint}</div>
          )}

          {/* sash cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {state.sashes.map((sash, i) => {
              const isActive = sash.active !== false;
              return (
                <div key={i} style={{ ...s.sashCard, opacity: isActive ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 11.5, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: ".05em" }}>
                      {dict.sashLabel} {i + 1}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                      <input type="checkbox" checked={isActive} onChange={(e) => setSash(i, { active: e.target.checked })} />
                      <span>{isActive ? dict.sashActiveOn : dict.sashActiveOff}</span>
                    </label>
                  </div>
                  <SashFields dict={dict} sash={sash} disabled={!isActive} onChange={(patch) => setSash(i, patch)} styles={s} />
                </div>
              );
            })}
          </div>

          <Field label={dict.glazingLabel} mt>
            <select style={s.select} value={state.glazing} onChange={(e) => set({ glazing: e.target.value })}>
              {dict.glazing.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label={dict.colorLabel}>
            <select style={s.select} value={state.color} onChange={(e) => set({ color: e.target.value })}>
              {dict.color.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label={dict.installationLabel}>
            <select style={s.select} value={state.installation} onChange={(e) => set({ installation: e.target.value })}>
              {dict.installationOptions.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <label style={s.check}>
              <input type="checkbox" checked={state.insectScreen} onChange={(e) => set({ insectScreen: e.target.checked })} />
              <span>{dict.insectScreenLabel}</span>
            </label>
            {state.insectScreen && (
              <div style={{ ...s.row, marginTop: 10 }}>
                <Field label={dict.insectScreenTypeLabel}>
                  <select style={s.select} value={state.insectScreenType} onChange={(e) => set({ insectScreenType: e.target.value })}>
                    {dict.insectScreenTypes.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={dict.insectScreenColorLabel}>
                  <select style={s.select} value={state.insectScreenColor} onChange={(e) => set({ insectScreenColor: e.target.value })}>
                    {dict.insectScreenColors.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </Field>
        </div>

        {/* RIGHT: diagram + summary */}
        <div>
          <div style={s.panel}>
            <h2 style={s.h2}>{dict.diagramTitle}</h2>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginBottom: 6 }}>{dict.diagramViewLabel}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <SpecDrawing
                width={state.width}
                height={state.height}
                material={state.material}
                sashes={state.sashes}
                selected={selectedSash}
                onSelectSash={(i) => setSelectedSash((sel) => (sel === i ? null : i))}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 4 }}>{dict.diagramLegend}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 2 }}>{dict.diagramClickHint}</div>

            {selectedSash !== null && state.sashes[selectedSash] && (
              <div style={{ marginTop: 12, border: `1.5px solid ${accent}`, borderRadius: 8, background: "var(--color-mint-light)", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 12, fontWeight: 600, color: accent }}>
                    {dict.sashLabel} {selectedSash + 1}
                  </span>
                  <button type="button" onClick={() => setSelectedSash(null)} style={s.iconBtn} aria-label="Close">
                    ×
                  </button>
                </div>
                <SashFields
                  dict={dict}
                  sash={state.sashes[selectedSash]}
                  disabled={state.sashes[selectedSash].active === false}
                  onChange={(patch) => setSash(selectedSash, patch)}
                  styles={s}
                />
              </div>
            )}
          </div>

          <div style={{ ...s.panel, marginTop: 16 }}>
            <h2 style={s.h2}>{dict.summaryTitle}</h2>

            {items.length > 0 && (
              <>
                <div style={{ ...s.sumRow, borderBottom: "none", paddingBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{dict.projectItemsTitle}</span>
                </div>
                {items.map((it, i) => {
                  const mat = it.material === "pvc" ? dict.materialPVC : it.material === "wood" ? dict.materialWood : dict.materialAluminum;
                  const pt = it.productType === "balconyDoor" ? dict.productTypeDoor : dict.productTypeWindow;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 0", borderBottom: "1px solid var(--color-border)", fontSize: 12.5 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--color-text)" }}>
                          {i + 1}. {pt} — {mat}
                        </div>
                        <div style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 11.5 }}>
                          {it.width}×{it.height}mm · ×{it.quantity}
                        </div>
                      </div>
                      {showPrices && <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 600, color: "var(--color-text)" }}>{fmtC(it.totalPrice)}</div>}
                      <button type="button" onClick={() => removeItem(i)} style={s.iconBtn} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  );
                })}
                {showPrices && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, paddingTop: 8, color: "var(--color-text-secondary)" }}>
                    <span>{dict.itemsSubtotalLabel}</span>
                    <span>{fmtC(itemsSubtotal)}</span>
                  </div>
                )}
              </>
            )}

            <SumRow k={dict.summaryArea} v={`${fmtN(result.areaM2, 2)} m²`} s={s} />
            <SumRow k={dict.summaryPerimeter} v={`${fmtN(result.perimeterM, 2)} m`} s={s} />
            {showPrices && (
              <>
                <SumRow k={dict.summaryMaterialCost} v={fmtC(result.materialCost)} s={s} />
                <SumRow k={dict.summaryProfileCost} v={fmtC(result.profileCost)} s={s} />
                <SumRow k={dict.summaryOptionsCost} v={fmtC(result.optionsCost)} s={s} />
              </>
            )}
            <SumRow k={dict.uwLabel} v={`${fmtN(uw, 2)} W/m²K`} s={s} />

            {showPrices && (
              <>
                <button
                  type="button"
                  onClick={() => setEcobonusOpen((o) => !o)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--color-mint-light)", border: "none", borderRadius: 999, padding: "8px 16px", margin: "10px 0 4px", cursor: "pointer", fontWeight: 800, fontStyle: "italic", fontSize: 15, color: accent }}
                >
                  {dict.ecobonusToggle}
                </button>
                {ecobonusOpen && (
                  <div style={{ padding: "10px 12px 4px", marginBottom: 8, borderLeft: `3px solid ${accent}`, background: "var(--color-mint-light)" }}>
                    <Field label={dict.ecobonusPercentLabel}>
                      <input
                        style={s.input}
                        type="number"
                        min={0}
                        max={100}
                        value={ecobonusPct}
                        onChange={(e) => setEcobonusPct(clamp(parseFloat(e.target.value) || 0, 0, 100))}
                      />
                    </Field>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, padding: "8px 0" }}>
                  <label style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-text)", letterSpacing: ".03em", textTransform: "uppercase" }}>{dict.discountLabel}</label>
                  <input style={{ ...s.input, width: 84, textAlign: "right" }} type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(clamp(parseFloat(e.target.value) || 0, 0, 100))} />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                  <label style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-text)", letterSpacing: ".03em", textTransform: "uppercase" }}>{dict.vatPercentLabel}</label>
                  <input
                    style={{ ...s.input, width: 84, textAlign: "right" }}
                    type="number"
                    min={0}
                    max={100}
                    value={vatPct}
                    onChange={(e) => setVatPct(clamp(parseFloat(e.target.value) || 0, 0, 100))}
                  />
                </div>

                <div style={{ marginTop: 14, padding: 16, borderRadius: 8, background: accent, color: accentInk }}>
                  <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.85 }}>{dict.summaryTotal}</div>
                  <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 28, fontWeight: 600, marginTop: 4 }}>{fmtC(grossGrand)}</div>
                  {ecobonusPct > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, opacity: 0.9, marginTop: 6, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                      <span>ECOBONUS (-{ecobonusPct}%)</span>
                      <span>-{fmtC(ecobonusAmount)}</span>
                    </div>
                  )}
                  {discountPct > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, opacity: 0.9, marginTop: 6, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                      <span>{dict.discountLabel} (-{discountPct}%)</span>
                      <span>-{fmtC(discountAmount)}</span>
                    </div>
                  )}
                  {(ecobonusPct > 0 || discountPct > 0) && (
                    <div style={{ marginTop: 10, paddingTop: 12, borderTop: "3px solid rgba(255,255,255,.85)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>{dict.totalFinalLabel}</span>
                      <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 22, fontWeight: 700 }}>{fmtC(finalGrand)}</span>
                    </div>
                  )}
                  {state.quantity > 1 && (
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                      {fmtC(result.unitPrice)} {dict.perUnit} · {state.quantity} {dict.units}
                    </div>
                  )}
                </div>
              </>
            )}

            {step === "config" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={addAnother} style={s.btnSecondary}>
                  {dict.continueBtn}
                </button>
                <button type="button" data-tw-primary onClick={() => setStep("lead")} style={{ ...s.btnPrimary, background: accent, color: accentInk }}>
                  {dict.finishBtn}
                </button>
              </div>
            )}

            {step === "lead" && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <input style={s.input} placeholder={dict.leadNameLabel} value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
                <input style={s.input} type="email" placeholder={dict.leadEmailLabel} value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
                <input style={s.input} placeholder={dict.leadPhoneLabel} value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
                <textarea style={{ ...s.input, minHeight: 70 }} placeholder={dict.leadMessageLabel} value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} />
                {/* honeypot */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                  aria-hidden="true"
                />
                {error && <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}
                <button type="button" data-tw-primary disabled={submitting} onClick={submit} style={{ ...s.btnPrimary, background: accent, color: accentInk, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? dict.submitting : dict.submitBtn}
                </button>
                <button type="button" onClick={() => setStep("config")} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>
                  ←
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 11.5, color: "var(--color-text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
        {dict.footerDisclaimer}
        {preview ? " · preview" : ""}
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function Field({ label, children, mt }: { label?: string; children: React.ReactNode; mt?: boolean }) {
  return (
    <div style={{ marginBottom: 16, marginTop: mt ? 4 : undefined }}>
      {label && <label style={{ display: "block", fontSize: 13.5, fontWeight: 700, marginBottom: 6, color: "var(--color-text)" }}>{label}</label>}
      {children}
    </div>
  );
}

function SumRow({ k, v, s }: { k: string; v: string; s: typeof STYLES }) {
  return (
    <div style={s.sumRow}>
      <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
      <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 500, color: "var(--color-text)" }}>{v}</span>
    </div>
  );
}

function SashFields({
  dict,
  sash,
  disabled,
  onChange,
  styles,
}: {
  dict: ReturnType<typeof getDict>;
  sash: Sash;
  disabled: boolean;
  onChange: (patch: Partial<Sash>) => void;
  styles: typeof STYLES;
}) {
  const dirDisabled = disabled || sash.type === "fix";
  const hwDisabled = disabled || sash.type === "fix";
  return (
    <>
      <div style={styles.row}>
        <MiniField label={dict.openingTypeLabel}>
          <select style={styles.select} value={sash.type} disabled={disabled} onChange={(e) => onChange({ type: e.target.value as SashType })}>
            {dict.sashTypes.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
        <MiniField label={dict.directionLabel}>
          <select style={styles.select} value={sash.direction} disabled={dirDisabled} onChange={(e) => onChange({ direction: e.target.value as Direction })}>
            {dict.directions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
      </div>
      <div style={styles.row}>
        <MiniField label={dict.hardwareLabel}>
          <select style={styles.select} value={sash.hardware} disabled={hwDisabled} onChange={(e) => onChange({ hardware: e.target.value })}>
            {dict.hardwareBrands.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
        <MiniField label={dict.hardwareColorLabel}>
          <select style={styles.select} value={sash.hardwareColor} disabled={hwDisabled} onChange={(e) => onChange({ hardwareColor: e.target.value })}>
            {dict.hardwareColors.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
      </div>
    </>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <label style={{ fontSize: 11.5, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 4, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}

/* ---------------- styles ---------------- */

const STYLES = {
  wrap: {
    fontFamily: "var(--tw-font, var(--font-space-grotesk), 'Segoe UI', system-ui, sans-serif)",
    color: "var(--color-text)",
    background: "var(--color-bg)",
    padding: 24,
    maxWidth: 1120,
    margin: "0 auto",
    WebkitFontSmoothing: "antialiased",
  } as React.CSSProperties,
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" } as React.CSSProperties,
  brandMark: { width: 40, height: 40, borderRadius: 8, background: "var(--color-mint)", color: "var(--color-mint-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 600, fontSize: 13, flexShrink: 0 } as React.CSSProperties,
  materials: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" } as React.CSSProperties,
  materialTab: { flex: "1 1 150px", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--color-border)", background: "var(--color-bg-alt)", cursor: "pointer", textAlign: "left" } as React.CSSProperties,
  swatch: { width: 26, height: 26, borderRadius: 6, flexShrink: 0, border: "1.5px solid rgba(0,0,0,.08)" } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20, alignItems: "start" } as React.CSSProperties,
  panel: { background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  h2: { fontSize: 15, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--color-text)", margin: "0 0 16px", fontWeight: 800 } as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  input: { width: "100%", padding: "10px 11px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 13.5, color: "var(--color-text)" } as React.CSSProperties,
  select: { width: "100%", padding: "10px 11px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: 13.5, color: "var(--color-text)" } as React.CSSProperties,
  hint: { fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 5 } as React.CSSProperties,
  check: { display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", border: "1.5px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", cursor: "pointer", fontSize: 13.5, color: "var(--color-text)" } as React.CSSProperties,
  sashCard: { border: "1.5px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", padding: 12 } as React.CSSProperties,
  typeBtn: { flex: 1, padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "center", color: "var(--color-text)" } as React.CSSProperties,
  sumRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, padding: "7px 0", borderBottom: "1px solid var(--color-border)" } as React.CSSProperties,
  btnSecondary: { width: "100%", padding: 11, borderRadius: 8, border: "1.5px solid var(--color-mint)", background: "transparent", color: "var(--color-mint)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--font-space-grotesk), sans-serif" } as React.CSSProperties,
  btnPrimary: { width: "100%", padding: 11, borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--tw-font, var(--font-space-grotesk), sans-serif)" } as React.CSSProperties,
  iconBtn: { width: 22, height: 22, borderRadius: "50%", border: "none", background: "var(--color-bg-alt)", color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1, cursor: "pointer", flexShrink: 0 } as React.CSSProperties,
};
