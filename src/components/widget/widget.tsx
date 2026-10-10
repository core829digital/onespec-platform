"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SpecDrawing } from "./spec-drawing";
import { WidgetFinishPicker } from "./widget-finish-picker";
import { getDict, LOCALE_CFG, labelFromList } from "./widget-i18n";
import { readableInk, isSafeColor, resolveFontStack } from "./widget-theme";
import { postToHost, readHostTheme } from "./host-bridge";
import { demoCopy, demoRegisterUrl } from "@/lib/demo/demo-copy";
import { submitErrorMessage, wizardCopy } from "./simple-wizard-model";
import { getTurnstileToken } from "@/lib/turnstile-client";
import { postQuote } from "./post-quote";
import { brandChoices, catalogOptions, catalogPricing, glazingChoices, pricingPayload, reconcileState, type WidgetCatalog, type WidgetOptions } from "./widget-catalog";
import { withLeafWidth } from "./leaf-edit";
import { REGION_FLAT_OPTION_KINDS, calculatePrice, type ProjectItem } from "@/shared/pricing";
import { quoteTotals } from "@/shared/quote-totals";
import { glazingAdvice, PACKAGE_DEPTHS, packageKey, parseGlazingKey } from "@/shared/glazing-packages";
import { frameRules, inactiveLeaves, normalizedRatios, type EditorSash, directionFromOpening, hasOpeningDirection, openingSide, retypeSash, typeForAddedSash } from "@/shared/sash-rules";
import {
  defaultConfig,
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
    ecobonusEnabled?: boolean;
    ecobonusMaxPercent?: number;
    discountEnabled?: boolean;
    discountMaxPercent?: number;
    /** Region policy — server-authoritative (resolved from the tenant's country). */
    region?: string;
    widgetMode?: "lead_gen" | "transparent";
    transparentAllowed?: boolean;
    vatRates?: Array<{ key: string; percent: number; label: string }>;
    defaultVatKey?: string;
    complianceFlags?: string[];
    branding?: {
      colorAccent?: string;
      colorAccentInk?: string | null;
      fontFamily?: string;
      companyInfo?: { name?: string };
      logoUrl?: string | null;
      logoLightUrl?: string | null;
      /** Owner-written headline / subheadline / CTA per widget language (Branding tab). */
      copy?: Record<string, { headline?: string; subheadline?: string; ctaLabel?: string } | undefined>;
    };
    /** Sanitized catalogue snapshot — drives option lists and preview pricing. */
    catalog?: WidgetCatalog | null;
    /** Owner's privacy notice URL for the consent checkbox (Annex D of the DPA). */
    privacyUrl?: string | null;
  };
  theme: string;
  lang: string;
  preview: boolean;
  /** Host-site accent from the embed snippet (?accent=). */
  accentOverride?: string;
  /** Host-site font from the embed snippet (?font=). */
  fontOverride?: string;
  /** Public demo on onespec.eu: fully interactive, but nothing is ever sent. */
  demo?: boolean;
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

/** A new piece: the catalogue's default quality, a profile of that quality and glazing that profile can hold (never a key the catalogue lacks). */
function freshState(options: WidgetOptions): ConfigState {
  const base = defaultConfig();
  const withGlazing = options.glazing.some(([k]) => k === "d24_floatBeArgon") ? { ...base, glazing: "d24_floatBeArgon" } : base;
  return reconcileState(options, withGlazing);
}

export function Widget({
  configurator,
  theme,
  lang,
  preview,
  accentOverride,
  fontOverride,
  demo = false,
}: WidgetProps) {
  const dict = getDict(lang);
  const cfg = LOCALE_CFG[lang] ?? LOCALE_CFG.en;
  // Owner's custom texts for this language; blank fields keep the defaults.
  const ownCopy = configurator.branding?.copy?.[lang];
  const submitLocale = (["it", "en", "fr", "nl", "de"].includes(lang) ? lang : "it") as
    | "it"
    | "en"
    | "fr"
    | "nl"
    | "de";

  // The region's VAT rate set (if any). When present the visitor picks a rate
  // from this list rather than typing a free number.
  const vatRates = configurator.vatRates ?? [];
  const isTransparent = (configurator.widgetMode ?? "lead_gen") === "transparent";
  const isLeadGen = !isTransparent;
  const complianceFlags = configurator.complianceFlags ?? [];

  const defaultVatRate =
    vatRates.find((r) => r.key === configurator.defaultVatKey) ?? vatRates[0];
  const initialVat =
    defaultVatRate?.percent ??
    (typeof configurator.vatRatePercent === "number" ? configurator.vatRatePercent : 22);
  const [vatPct, setVatPct] = useState(initialVat);

  // Option lists + price table for the LIVE PREVIEW, built from the tenant's
  // published catalogue (falling back to prototype defaults for any dimension
  // the catalogue doesn't define). The authoritative price is always recomputed
  // on the server; VAT is the one field the visitor can tweak.
  const catalog = configurator.catalog ?? undefined;
  const options = useMemo(
    () => catalogOptions(catalog, dict, cfg.locale),
    [catalog, dict, cfg.locale],
  );
  const pricing = useMemo(() => {
    const p = catalogPricing(catalog);
    p.vatRate = vatPct;
    return p;
  }, [catalog, vatPct]);

  const showPrices = configurator.showPricesToEndUser !== false;
  // Ecobonus is an Italian incentive: never offered in another market, whatever
  // the editor toggle says (the region is server-resolved from the owner's country).
  const ecobonusEnabled = configurator.ecobonusEnabled !== false && (configurator.region ?? "IT") === "IT";
  const ecobonusMax = clamp(configurator.ecobonusMaxPercent ?? 50, 0, 100);
  const discountEnabled = configurator.discountEnabled === true;
  const discountMax = clamp(configurator.discountMaxPercent ?? 20, 0, 100);

  // Host-page theme pushed via postMessage after mount (see the embed snippet).
  const [hostTheme, setHostTheme] = useState<HostTheme>({});

  // Accent precedence: postMessage from host > ?accent= > tenant branding > default.
  const accent = useMemo(() => {
    const candidates = [hostTheme.accent, accentOverride, configurator.branding?.colorAccent, "#16d19d"];
    return candidates.find((c) => isSafeColor(c)) ?? "#16d19d";
  }, [hostTheme.accent, accentOverride, configurator.branding?.colorAccent]);

  // The accent as TEXT on the widget surface: pulled towards the theme text colour so it keeps AA contrast.
  const accentText = `color-mix(in srgb, ${accent} 45%, var(--color-text))`;

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

  // The initial glazing is the first package (24 mm double, low-E, argon) when the catalogue offers it.
  const [state, setState] = useState<ConfigState>(() => freshState(options));
  const [items, setItems] = useState<SavedItem[]>([]);
  // Fitting (posa) included or supply only; null = the installer's default. One choice for the whole project.
  const [fittingChoice, setFittingChoice] = useState<boolean | null>(null);
  const [selectedSash, setSelectedSash] = useState<number | null>(null);
  const [ecobonusOpen, setEcobonusOpen] = useState(false);
  const [ecobonusPct, setEcobonusPct] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);

  const [step, setStep] = useState<"config" | "lead" | "success">("config");
  const [demoNotice, setDemoNotice] = useState(false);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [consent, setConsent] = useState(false);
  const [successSummary, setSuccessSummary] = useState("");

  // ---- theme ----
  useEffect(() => {
    const apply = (t: "light" | "dark") => document.documentElement.setAttribute("data-theme", t);
    if (theme === "light" || theme === "dark") {
      apply(theme);
      return;
    }
    // "auto": follow the visitor's OS/browser preference (this used to fall
    // through to dark for everyone).
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => apply(mq.matches ? "light" : "dark");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [theme]);

  // ---- widget-open telemetry (skips preview; once per browser session) ----
  useEffect(() => {
    if (preview || demo || !CONVEX_SITE) return;
    const key = `onespec-vt-${configurator.publicId}`;
    let token: string;
    try {
      token = sessionStorage.getItem(key) ?? "";
      if (!token) {
        token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        sessionStorage.setItem(key, token);
      }
    } catch {
      token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    fetch(`${CONVEX_SITE}/api/widget/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId: configurator.publicId, viewToken: token }),
      keepalive: true,
    }).catch(() => {});
  }, [preview, demo, configurator.publicId]);

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

  // When the region's catalogue offers a region-specific option kind (FR pose
  // type, BE ventilation grille / …, NL deep-profile / …) one is always in
  // force — fall back to the first option so the preview + submitted price
  // include it, rather than silently pricing an unselected field at 0.
  const withRegionDefaults = useCallback(
    (it: ConfigState): ConfigState => {
      let out = it;
      for (const kind of REGION_FLAT_OPTION_KINDS) {
        const list = options.regionOptions[kind] ?? [];
        if (list.length > 0 && !out[kind]) out = { ...out, [kind]: list[0][0] };
      }
      return out;
    },
    [options.regionOptions],
  );

  // ---- derived ----
  const fittingOffered = pricing.installationPerM2 > 0;
  const withFitting = fittingChoice ?? pricing.installationDefault;
  // The total of a piece comes from the one pricing engine of the platform (the same the server records, the Showroom and the B2B
  // quote use); the local table only fills the breakdown lines and prices the demo, which has no catalogue.
  const payload = useMemo(() => pricingPayload(catalog), [catalog]);
  const sharedTotal = useCallback(
    (it: ConfigState): { unit: number; total: number } | null => {
      if (!payload) return null;
      const priced = calculatePrice(payload, [toSubmitItem(it) as unknown as ProjectItem]).items[0];
      return priced ? { unit: priced.unitPrice / 100, total: priced.itemTotalCents / 100 } : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, fittingOffered, withFitting],
  );
  const result = useMemo(() => {
    const local = calculate({ ...withRegionDefaults(state), withInstallation: withFitting }, pricing);
    const shared = sharedTotal(withRegionDefaults(state));
    return shared ? { ...local, unitPrice: shared.unit, totalPrice: shared.total } : local;
  }, [state, pricing, withRegionDefaults, withFitting, sharedTotal]);
  const uw = useMemo(() => computeUw(state), [state]);

  // Saved pieces are priced again with the current choice, so switching it updates the whole project.
  const itemPrice = (it: SavedItem) => sharedTotal(it)?.total ?? calculate({ ...it, withInstallation: withFitting }, pricing).totalPrice;
  const itemsSubtotal = items.reduce((s, it) => s + itemPrice(it), 0);
  // Catalogue prices are net: the VAT of the chosen rate (0% included) goes on top.
  // In whole cents, rounded exactly as the server does (shared/quote-totals): 22 % of 123,45 is never shown one cent apart.
  const netGrand = Math.round((itemsSubtotal + result.totalPrice) * 100) / 100;
  const grossCents = quoteTotals({ supplyExVatCents: Math.round(netGrand * 100), installCents: 0, demolitionCents: 0, regionalCents: 0, discountPercent: 0, vatPercent: vatPct }).grossCents;
  const vatAmount = (grossCents - Math.round(netGrand * 100)) / 100;
  const grossGrand = grossCents / 100;
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
  // Every change goes through reconcileState: a new quality swaps the profile, a new profile adapts the glazing.
  // Bicolour: which face the drawing shows (the inside one by default, like the technical drawing).
  const [face, setFace] = useState<"inside" | "outside">("inside");
  const bicolorOffered = pricing.bicolorEnabled && options.color.length > 1;
  const isBicolor = bicolorOffered && !!state.colorInside && state.colorInside !== state.color;
  const drawnColor = isBicolor && face === "inside" ? state.colorInside : state.color;
  const set = (patch: Partial<ConfigState>) => setState((s) => reconcileState(options, { ...s, ...patch }));

  const setSash = (i: number, patch: Partial<Sash>) =>
    setState((s) => {
      const { type, ...rest } = patch;
      let sashes = s.sashes.map((sash, idx) => (idx === i ? { ...sash, ...rest } : sash));
      // A different opening family drags the other moving leaves along (no sliding + hinged in one frame).
      if (type && type !== s.sashes[i]?.type) sashes = retypeSash(sashes, i, type) as Sash[];
      return { ...s, sashes };
    });

  const setSashCount = (raw: number) => {
    const n = clamp(Math.round(raw), SASH_MIN, SASH_MAX);
    setState((s) => {
      let sashes = s.sashes.slice();
      if (n > sashes.length) {
        for (let i = sashes.length; i < n; i++) {
          // Outermost leaf on the right: hinge right, handle towards the middle.
          const type: SashType = typeForAddedSash(sashes.map((x) => x.type)) === "sliding" ? "sliding" : "tiltturn";
          sashes.push({ type, direction: type === "tiltturn" ? "right" : "left", active: true, hardware: "maco", hardwareColor: "white" });
        }
      } else if (n < sashes.length) {
        sashes = sashes.slice(0, n);
      }
      // Whatever the leaves were, the shares must add up to the whole frame again (the leaf widths are typed on them).
      const shares = normalizedRatios(sashes as unknown as EditorSash[]);
      sashes = sashes.map((sh, k) => ({ ...sh, widthRatio: shares[k] }));
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
    setState((s) => reconcileState(options, { ...s, productType: pt, width: d.width, height: d.height, sashes: defaultSashPreset() }));
    setSelectedSash(null);
  };

  const changeMaterial = (m: Material) => set({ material: m });

  const addAnother = () => {
    setItems((prev) => [...prev, { ...state, unitPrice: result.unitPrice, totalPrice: result.totalPrice }]);
    setState(freshState(options));
    setSelectedSash(null);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // ---- submit ----
  function buildSpecSummary(all: ConfigState[]): string {
    const lines = all.map((it, i) => {
      const mat = it.material === "pvc" ? dict.materialPVC : it.material === "wood" ? dict.materialWood : dict.materialAluminum;
      const pt = it.productType === "balconyDoor" ? dict.productTypeDoor : dict.productTypeWindow;
      const q = labelFromList(options.quality[it.material] ?? dict.quality[it.material] ?? [], it.quality[it.material]);
      const brand =
        it.material === "pvc" || it.material === "aluminum"
          ? labelFromList(options.profileSystems[it.material] ?? dict.brands[it.material] ?? [], it.brand[it.material])
          : "";
      const glz = labelFromList(options.glazing.length > 0 ? options.glazing : dict.glazing, it.glazing);
      const colOut = labelFromList(options.color.length > 0 ? options.color : dict.color, it.color);
      const col = it.colorInside && it.colorInside !== it.color && pricing.bicolorEnabled
        ? `${colOut} (${dict.faceOutside.toLowerCase()}) / ${labelFromList(options.color.length > 0 ? options.color : dict.color, it.colorInside)} (${dict.faceInside.toLowerCase()})`
        : colOut;
      const inst = labelFromList(dict.installationOptions, it.installation);
      const regionBits = REGION_FLAT_OPTION_KINDS.map((kind) => {
        const chosen = it[kind];
        if (!chosen || chosen === "none" || chosen === "standard") return "";
        const label = labelFromList(options.regionOptions[kind] ?? [], chosen);
        const note = kind === "voletRoulant" ? " — hauteur de baie à confirmer au métrage" : "";
        return ` | ${dict.regionOptionLabels[kind] ?? kind}: ${label}${note}`;
      }).join("");
      const sashDesc = it.sashes
        .map(
          (s, si) =>
            `${si + 1}:${labelFromList(dict.sashTypes, s.type)}/${labelFromList(dict.directions, openingSide(s.type, s.direction)).split(" (")[0]}${s.active ? "" : "(off)"}`,
        )
        .join(", ");
      const screen = it.insectScreen
        ? ` | ${dict.insectScreenLabel}: ${labelFromList(dict.insectScreenTypes, it.insectScreenType)} / ${labelFromList(dict.insectScreenColors, it.insectScreenColor)}`
        : "";
      return `${i + 1}. ${pt} ${mat}${brand ? ` (${brand})` : ""} ${it.width}×${it.height}mm ×${it.quantity} | ${q}, ${glz}, ${col}, ${inst}${regionBits} | ${dict.sashLabel}: ${sashDesc}${screen}`;
    });
    if (fittingOffered) lines.push(withFitting ? dict.fittingIncludedLine : dict.fittingExcludedLine);
    if (ecobonusPct > 0) lines.push(`Ecobonus: -${ecobonusPct}%`);
    if (discountPct > 0) lines.push(`${dict.discountLabel}: -${discountPct}%`);
    for (const note of complianceFlags.map((f) => dict.compliance[f]).filter(Boolean)) {
      lines.push(note);
    }
    return lines.join("\n");
  }

  function toSubmitItem(it: ConfigState) {
    return {
      productType: it.productType,
      material: it.material,
      quality: it.quality,
      profileSystem:
        it.material === "pvc" || it.material === "aluminum" ? it.brand[it.material] || undefined : undefined,
      width: Math.round(it.width),
      height: Math.round(it.height),
      quantity: it.quantity,
      sashes: it.sashes.map((s) => ({
        type: s.type,
        direction: s.direction,
        active: s.active,
        hardware: s.hardware,
        hardwareColor: s.hardwareColor,
        widthRatio: s.widthRatio,
        handleHeightMm: s.handleHeightMm,
      })),
      glazing: it.glazing,
      color: it.color,
      colorInside: pricing.bicolorEnabled && it.colorInside && it.colorInside !== it.color ? it.colorInside : undefined,
      insectScreen: it.insectScreen,
      insectScreenType: it.insectScreen ? it.insectScreenType : undefined,
      insectScreenColor: it.insectScreen ? it.insectScreenColor : undefined,
      installation: it.installation,
      withInstallation: fittingOffered ? withFitting : undefined,
      ...Object.fromEntries(
        REGION_FLAT_OPTION_KINDS.map((kind) => [kind, it[kind] || undefined]),
      ),
    };
  }

  async function submit() {
    setError("");
    if (demo) {
      // Demo: never validate, never call Turnstile or the network.
      setDemoNotice(true);
      return;
    }
    if (!lead.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
      setError(dict.leadError);
      return;
    }
    if (!consent) {
      setError(dict.consentRequired);
      return;
    }
    setSubmitting(true);
    try {
      const all = [...items, state].map(withRegionDefaults);
      const userMsg = lead.message.trim();
      const spec = buildSpecSummary(all);
      const turnstileToken = await getTurnstileToken();
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
        clientVatPercent: vatPct,
        consent: true as const,
        consentVersion: "widget-1",
        turnstileToken: turnstileToken ?? undefined,
      };
      const data = await postQuote(`${CONVEX_SITE}/api/widget/quote`, body);
      if (data.ok) {
        setSuccessSummary(
          [
            userMsg,
            spec,
            data.referenceId ? `Ref. ${data.referenceId}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
        setStep("success");
        postToHost({ type: "onespec:submitted", publicId: configurator.publicId });
      } else {
        // Never surface raw server codes (RATE_LIMITED, VALIDATION…) to the visitor.
        setError(submitErrorMessage(wizardCopy(lang), data.error));
      }
    } catch {
      setError(wizardCopy(lang).errors.GENERIC);
    } finally {
      setSubmitting(false);
    }
  }

  // ---- styles (scoped, brand-token driven) ----
  const s = STYLES;

  if (demo && demoNotice) {
    const dc = demoCopy(lang);
    return (
      <div style={s.wrap}>
        <div style={{ ...s.panel, textAlign: "center", padding: 40 }} role="status">
          <h2 style={{ margin: "0 0 8px", color: "var(--color-text)" }}>{dc.title}</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 auto", maxWidth: 420 }}>{dc.body}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
            <a
              href={demoRegisterUrl(lang)}
              target="_top"
              style={{
                padding: "11px 20px",
                borderRadius: 10,
                background: "var(--tw-accent, var(--color-accent))",
                color: "var(--tw-accent-ink, #fff)",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {dc.cta}
            </a>
            <button
              type="button"
              onClick={() => setDemoNotice(false)}
              style={{
                padding: "11px 20px",
                borderRadius: 10,
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {dc.back}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div style={s.wrap}>
        <div style={{ ...s.panel, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
          <h2 style={{ margin: "0 0 8px", color: "var(--color-text)" }}>{dict.successTitle}</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>{dict.successBody}</p>
          {successSummary && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${configurator.name || dict.brandName}\n\n${successSummary}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 18,
                padding: "10px 18px",
                borderRadius: 10,
                background: "#25D366",
                color: "#04231a",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {dict.whatsappShare}
            </a>
          )}
        </div>
      </div>
    );
  }

  const materialTabs = options.materials;

  const brandOptions = brandChoices(options, state.material, state.quality[state.material]);
  const glazingOptions = glazingChoices(options, state.material, state.material === "pvc" || state.material === "aluminum" ? state.brand[state.material] : undefined);
  const hasBrand = (state.material === "pvc" || state.material === "aluminum") && brandOptions.length > 0;
  const noBrandForQuality = (state.material === "pvc" || state.material === "aluminum") && brandOptions.length === 0 && (options.profileRows[state.material]?.length ?? 0) > 0;
  const chosenSpec = options.profileRows[state.material]?.find((r) => r.key === (state.material === "pvc" || state.material === "aluminum" ? state.brand[state.material] : ""))?.spec;
  const ps = dict.profileSpec;
  const profileInfo = chosenSpec
    ? [
        chosenSpec.chambers ? ps.chambers.replace("{n}", String(chosenSpec.chambers)) : "",
        chosenSpec.depthMm ? ps.depth.replace("{mm}", String(chosenSpec.depthMm)) : "",
        chosenSpec.gasket ? (chosenSpec.gasket === "triple" ? ps.gasketTriple : ps.gasketStandard) : "",
        chosenSpec.maxGlassMm ? ps.maxGlass.replace("{mm}", String(chosenSpec.maxGlassMm)) : "",
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <div style={s.wrap}>
      {/* header */}
      <div style={s.header} data-tw-header>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} data-tw-brand>
          {configurator.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={configurator.branding.logoUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }} />
          ) : (
            <div style={s.brandMark}>W/D</div>
          )}
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: "var(--color-text)" }}>
              {ownCopy?.headline?.trim() || configurator.name || dict.brandName}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
              {ownCopy?.subheadline?.trim() || dict.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* material tabs */}
      <div style={{ ...s.materials, ["--tw-n" as string]: materialTabs.length }} data-tw-materials>
        {materialTabs.map((m) => {
          const active = state.material === m.key;
          return (
            <button
              key={m.key}
              type="button"
              data-tw-tab
              data-tw-material
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
                    ...(state.productType === pt ? { borderColor: accent, background: "var(--color-mint-light)", color: accentText } : {}),
                  }}
                >
                  {pt === "window" ? dict.productTypeWindow : dict.productTypeDoor}
                </button>
              ))}
            </div>
            {state.productType === "balconyDoor" && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: accentText, fontWeight: 600 }}>{dict.thresholdNote}</div>
            )}
          </Field>

          <Field label={dict.qualityLabel} id="widget-quality">
            <select id="widget-quality" style={s.select} value={state.quality[state.material]} onChange={(e) => set({ quality: { ...state.quality, [state.material]: e.target.value } })}>
              {options.quality[state.material].map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          {noBrandForQuality && <div style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 8 }}>{ps.noProfiles}</div>}
          {hasBrand && (
            <Field label={dict.brandLabel} id="widget-brand">
              <select
                id="widget-brand"
                style={s.select}
                value={state.brand[state.material as "pvc" | "aluminum"]}
                onChange={(e) => set({ brand: { ...state.brand, [state.material]: e.target.value } })}
              >
                {brandOptions.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {profileInfo ? <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--color-text-secondary)" }}>{profileInfo}</div> : null}
            </Field>
          )}

          <div style={s.row}>
            <Field label={dict.widthLabel} id="widget-width">
              <input
                id="widget-width"
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
            <Field label={dict.heightLabel} id="widget-height">
              <input
                id="widget-height"
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
            <Field label={dict.quantityLabel} id="widget-quantity">
              <input
                id="widget-quantity"
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
            <Field label={dict.sashCountLabel} id="widget-sash-count">
              <input
                id="widget-sash-count"
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
          {frameRules(state.sashes as unknown as Parameters<typeof frameRules>[0]).map((code) => (
            <div key={code} style={s.hint} role="note">{dict.frameRules[code]}</div>
          ))}
          {state.sashes.length === 1 && (
            <div style={{ ...s.hint, color: accentText, fontWeight: 600 }}>{dict.singleSashCapHint}</div>
          )}

          {/* sash cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {state.sashes.map((sash, i) => {
              const isActive = sash.active !== false;
              return (
                <div key={i} style={{ ...s.sashCard, opacity: isActive ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 11.5, fontWeight: 600, color: accentText, textTransform: "uppercase", letterSpacing: ".05em" }}>
                      {dict.sashLabel} {i + 1}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                      <input type="checkbox" checked={isActive} onChange={(e) => setSash(i, { active: e.target.checked })} />
                      <span>{isActive ? dict.sashActiveOn : dict.sashActiveOff}</span>
                    </label>
                  </div>
                  <SashFields dict={dict} options={options} sash={sash} disabled={!isActive} onChange={(patch) => setSash(i, patch)} styles={s} />
                </div>
              );
            })}
          </div>

          {(() => {
            const parsed = parseGlazingKey(state.glazing);
            const rows = glazingOptions.map(([k, v]) => ({ key: k, label: v, p: parseGlazingKey(k) }));
            const packages = rows.filter((r) => r.p);
            const plain = (
              <Field label={dict.glazingLabel} mt id="widget-glazing">
                <select id="widget-glazing" style={s.select} value={state.glazing} onChange={(e) => set({ glazing: e.target.value })}>
                  {glazingOptions.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            );
            if (packages.length === 0) return plain;
            const gp = dict.glazingPicker;
            const depths: Array<{ family: "double" | "triple"; depth: number }> = [];
            for (const family of ["double", "triple"] as const) {
              for (const depth of PACKAGE_DEPTHS[family]) if (packages.some((r) => r.p!.family === family && r.p!.depthMm === depth)) depths.push({ family, depth });
            }
            const shown = parsed ? packages.filter((r) => r.p!.family === parsed.family && r.p!.depthMm === parsed.depthMm) : [];
            const strip = (label: string) => label.replace(/\s·\s\d+\smm$/, "");
            const pickDepth = (raw: string) => {
              const [family, depth] = raw.split("-");
              const keep = parsed ? rows.find((r) => r.key === packageKey(family as "double" | "triple", Number(depth), parsed.composition.id)) : undefined;
              const next = keep ?? packages.find((r) => r.p!.family === family && r.p!.depthMm === Number(depth));
              if (next) set({ glazing: next.key });
            };
            return (
              <>
                <Field label={gp.depth} mt id="widget-glazing-depth">
                  <select id="widget-glazing-depth" style={s.select} value={parsed ? `${parsed.family}-${parsed.depthMm}` : "legacy"} onChange={(e) => pickDepth(e.target.value)}>
                    {!parsed ? <option value="legacy" disabled>{rows.find((r) => r.key === state.glazing)?.label ?? state.glazing}</option> : null}
                    {depths.map(({ family, depth }) => (
                      <option key={`${family}-${depth}`} value={`${family}-${depth}`}>{gp[family]} · {depth} mm</option>
                    ))}
                  </select>
                </Field>
                <Field label={gp.composition} id="widget-glazing">
                  <select id="widget-glazing" style={s.select} value={state.glazing} disabled={!parsed} onChange={(e) => set({ glazing: e.target.value })}>
                    {!parsed ? <option value={state.glazing}>{rows.find((r) => r.key === state.glazing)?.label ?? state.glazing}</option> : null}
                    {shown.map((r) => (
                      <option key={r.key} value={r.key}>{strip(r.label)}</option>
                    ))}
                  </select>
                </Field>
                {glazingAdvice(state.glazing, state.height, state.productType === "balconyDoor" ? "porta" : undefined).map((code) => (
                  <div key={code} style={{ ...s.hint, ...(code === "tooTall" || code === "tallBeyond" ? { color: "#B45309", fontWeight: 600 } : {}) }} role="note">{gp.advice[code]}</div>
                ))}
              </>
            );
          })()}

          <Field label={isBicolor ? dict.colorOutsideLabel : dict.colorLabel} id="widget-color">
            <WidgetFinishPicker id="widget-color" lang={lang} value={state.color} pairs={options.color} meta={options.colorMeta} text={dict.finishPicker} onChange={(key) => set({ color: key, ...(state.colorInside === key ? { colorInside: "" } : {}) })} styles={s} />
          </Field>
          {bicolorOffered ? (
            <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, margin: "2px 0 10px", fontSize: 13.5, cursor: "pointer", color: "var(--color-text)" }}>
              <input
                type="checkbox"
                style={{ width: 20, height: 20, flexShrink: 0, accentColor: accent }}
                checked={isBicolor}
                onChange={(e) => set({ colorInside: e.target.checked ? (options.color.find(([k]) => k !== state.color)?.[0] ?? "") : "" })}
              />
              <span>{dict.bicolorToggle}</span>
            </label>
          ) : null}
          {isBicolor ? (
            <Field label={dict.colorInsideLabel} id="widget-color-inside">
              <WidgetFinishPicker id="widget-color-inside" lang={lang} value={state.colorInside} pairs={options.color} meta={options.colorMeta} text={dict.finishPicker} onChange={(key) => set({ colorInside: key === state.color ? "" : key })} styles={s} />
            </Field>
          ) : null}

          <Field label={dict.installationLabel} id="widget-installation">
            <select id="widget-installation" style={s.select} value={state.installation} onChange={(e) => set({ installation: e.target.value })}>
              {options.installations.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          {REGION_FLAT_OPTION_KINDS.map((kind) => {
            const list = options.regionOptions[kind] ?? [];
            if (list.length === 0) return null;
            return (
              <Field key={kind} label={dict.regionOptionLabels[kind] ?? kind}>
                <select
                  style={s.select}
                  value={withRegionDefaults(state)[kind]}
                  onChange={(e) => set({ [kind]: e.target.value })}
                >
                  {list.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            );
          })}

          <Field>
            <label style={s.check}>
              <input type="checkbox" checked={state.insectScreen} onChange={(e) => set({ insectScreen: e.target.checked })} />
              <span>{dict.insectScreenLabel}</span>
            </label>
            {state.insectScreen && (
              <div style={{ ...s.row, marginTop: 10 }}>
<Field label={dict.insectScreenTypeLabel} id="widget-insect-screen-type">
                    <select id="widget-insect-screen-type" style={s.select} value={state.insectScreenType} onChange={(e) => set({ insectScreenType: e.target.value })}>
                      {options.screenTypes.map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={dict.insectScreenColorLabel} id="widget-insect-screen-color">
                    <select id="widget-insect-screen-color" style={s.select} value={state.insectScreenColor} onChange={(e) => set({ insectScreenColor: e.target.value })}>
                      {options.screenColors.map(([k, v]) => (
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
                door={state.productType === "balconyDoor"}
                sashes={state.sashes}
                selected={selectedSash}
                onSelectSash={(i) => setSelectedSash((sel) => (sel === i ? null : i))}
                onResizeSash={(idx, leftRatio) =>
                  setState((prev) => {
                    const sashes = prev.sashes.map((sh) => ({
                      ...sh,
                      widthRatio:
                        typeof sh.widthRatio === "number" && sh.widthRatio > 0
                          ? sh.widthRatio
                          : 1 / prev.sashes.length,
                    }));
                    const pair = sashes[idx].widthRatio! + sashes[idx + 1].widthRatio!;
                    sashes[idx].widthRatio = Math.max(0.05, Math.min(pair - 0.05, leftRatio));
                    sashes[idx + 1].widthRatio = pair - sashes[idx].widthRatio!;
                    return { ...prev, sashes };
                  })
                }
                onEditLeafWidth={(idx, mm) =>
                  setState((prev) => {
                    const next = withLeafWidth(prev.width, prev.sashes, idx, mm);
                    return next ? { ...prev, sashes: next } : prev;
                  })
                }
                leafText={{ edit: dict.leafEdit, invalid: dict.leafInvalid }}
                finish={drawnColor}
                finishHex={options.colorMeta[drawnColor]?.texture || !["white", "anthracite", "woodgrain"].includes(drawnColor) ? options.colorMeta[drawnColor]?.hex : undefined}
                finishTexture={options.colorMeta[drawnColor]?.texture}
              />
              {isBicolor ? (
                <div role="group" aria-label={dict.diagramViewLabel} style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
                  {(["inside", "outside"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={face === f}
                      onClick={() => setFace(f)}
                      style={{ minHeight: 36, padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${face === f ? accent : "var(--color-border)"}`, background: face === f ? "var(--color-mint-light)" : "var(--color-bg-alt)", color: "var(--color-text)" }}
                    >
                      {f === "inside" ? dict.faceInside : dict.faceOutside}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 4 }}>{dict.diagramLegend}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 2 }}>{dict.diagramClickHint}</div>
            {state.sashes.length > 1 && (
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 2 }}>{dict.leafHint}</div>
            )}

            {selectedSash !== null && state.sashes[selectedSash] && (
              <div style={{ marginTop: 12, border: `1.5px solid ${accent}`, borderRadius: 8, background: "var(--color-mint-light)", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 12, fontWeight: 600, color: accentText }}>
                    {dict.sashLabel} {selectedSash + 1}
                  </span>
                  <button type="button" onClick={() => setSelectedSash(null)} style={s.iconBtn} aria-label="Close">
                    ×
                  </button>
                </div>
                <SashFields
                  dict={dict}
                  options={options}
                  sash={state.sashes[selectedSash]}
                  disabled={state.sashes[selectedSash].active === false}
                  onChange={(patch) => setSash(selectedSash, patch)}
                  styles={s}
                />
                {state.sashes[selectedSash].active !== false && state.sashes[selectedSash].type !== "fix" && !inactiveLeaves(state.sashes as unknown as Parameters<typeof inactiveLeaves>[0]).has(selectedSash) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...s.hint, marginBottom: 4 }}>
                      {dict.handleHeightLabel}:{" "}
                      <strong style={{ color: "var(--color-text)" }}>
                        {state.sashes[selectedSash].handleHeightMm ?? Math.round(state.height / 2)} mm
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={Math.min(300, state.height - 100)}
                      max={Math.max(400, state.height - 150)}
                      step={10}
                      value={state.sashes[selectedSash].handleHeightMm ?? Math.round(state.height / 2)}
                      onChange={(e) => setSash(selectedSash, { handleHeightMm: parseInt(e.target.value, 10) })}
                      style={{ width: "100%", accentColor: accent }}
                    />
                  </div>
                )}
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
                      {showPrices && <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 600, color: "var(--color-text)" }}>{fmtC(itemPrice(it))}</div>}
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
                {ecobonusEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEcobonusOpen((o) => !o)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--color-mint-light)", border: "none", borderRadius: 999, padding: "8px 16px", margin: "10px 0 4px", cursor: "pointer", fontWeight: 800, fontStyle: "italic", fontSize: 15, color: accentText }}
                    >
                      {dict.ecobonusToggle}
                    </button>
                    {ecobonusOpen && (
                      <div style={{ padding: "10px 12px 4px", marginBottom: 8, borderLeft: `3px solid ${accent}`, background: "var(--color-mint-light)" }}>
                        <Field label={dict.ecobonusPercentLabel} id="widget-ecobonus">
                          <input
                            id="widget-ecobonus"
                            style={s.input}
                            type="number"
                            min={0}
                            max={ecobonusMax}
                            value={ecobonusPct}
                            onChange={(e) => setEcobonusPct(clamp(parseFloat(e.target.value) || 0, 0, ecobonusMax))}
                          />
                        </Field>
                      </div>
                    )}
                  </>
                )}

                {discountEnabled && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, padding: "8px 0" }}>
                    <label htmlFor="widget-discount" style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-text)", letterSpacing: ".03em", textTransform: "uppercase" }}>{dict.discountLabel}</label>
                    <input id="widget-discount" style={{ ...s.input, width: 84, textAlign: "right" }} type="number" min={0} max={discountMax} value={discountPct} onChange={(e) => setDiscountPct(clamp(parseFloat(e.target.value) || 0, 0, discountMax))} />
                  </div>
                )}

                {fittingOffered && (
                  <fieldset style={{ border: "none", margin: 0, padding: "8px 0" }}>
                    <legend style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-text)", letterSpacing: ".03em", textTransform: "uppercase", padding: 0, marginBottom: 6 }}>{dict.fittingTitle}</legend>
                    <div role="radiogroup" aria-label={dict.fittingTitle} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {([true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          role="radio"
                          aria-checked={withFitting === v}
                          onClick={() => setFittingChoice(v)}
                          style={{ ...s.input, flex: 1, minWidth: 130, cursor: "pointer", fontWeight: withFitting === v ? 800 : 500, outline: withFitting === v ? `2px solid ${accent}` : "none" }}
                        >
                          {v ? dict.fittingWith : dict.fittingWithout}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                  <label htmlFor="widget-vat" style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-text)", letterSpacing: ".03em", textTransform: "uppercase" }}>
                    {vatRates.length > 0 ? dict.vatRateLabel : dict.vatPercentLabel}
                  </label>
                  {vatRates.length > 0 ? (
                    <select
                      id="widget-vat"
                      style={{ ...s.input, width: 200, textAlign: "right" }}
                      value={vatPct}
                      onChange={(e) => setVatPct(parseFloat(e.target.value))}
                    >
                      {vatRates.map((r) => (
                        <option key={r.key} value={r.percent}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="widget-vat"
                      style={{ ...s.input, width: 84, textAlign: "right" }}
                      type="number"
                      min={0}
                      max={100}
                      value={vatPct}
                      onChange={(e) => setVatPct(clamp(parseFloat(e.target.value) || 0, 0, 100))}
                    />
                  )}
                </div>

                <div style={{ marginTop: 14, padding: 16, borderRadius: 8, background: accent, color: accentInk }}>
                  <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.85 }}>{dict.summaryTotal}</div>
                  <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 28, fontWeight: 600, marginTop: 4 }}>{fmtC(grossGrand)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9, marginTop: 6, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                    <span>{dict.summaryNet}</span>
                    <span>{fmtC(netGrand)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                    <span>{dict.summaryVat.replace("{n}", String(vatPct))}</span>
                    <span>{fmtC(vatAmount)}</span>
                  </div>
                  {isLeadGen && (
                    <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>{dict.estimateNotContractual}</div>
                  )}
                  {complianceFlags
                    .map((f) => dict.compliance[f])
                    .filter(Boolean)
                    .map((note) => (
                      <div key={note} style={{ fontSize: 11.5, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>{note}</div>
                    ))}
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
                <button type="button" onClick={addAnother} disabled={noBrandForQuality} style={{ ...s.btnSecondary, ...(noBrandForQuality ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
                  {dict.continueBtn}
                </button>
                <button type="button" data-tw-primary onClick={() => setStep("lead")} disabled={noBrandForQuality} style={{ ...s.btnPrimary, background: accent, color: accentInk, ...(noBrandForQuality ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
                  {dict.finishBtn}
                </button>
              </div>
            )}

            {step === "lead" && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor="widget-lead-name">{dict.leadNameLabel}</label>
                <input id="widget-lead-name" style={s.input} placeholder={dict.leadNameLabel} value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
                <label htmlFor="widget-lead-email">{dict.leadEmailLabel}</label>
                <input id="widget-lead-email" style={s.input} type="email" placeholder={dict.leadEmailLabel} value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
                <label htmlFor="widget-lead-phone">{dict.leadPhoneLabel}</label>
                <input id="widget-lead-phone" style={s.input} placeholder={dict.leadPhoneLabel} value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
                <label htmlFor="widget-lead-message">{dict.leadMessageLabel}</label>
                <textarea id="widget-lead-message" style={{ ...s.input, minHeight: 70 }} placeholder={dict.leadMessageLabel} value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} />
                {/* honeypot */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                  aria-hidden="true"
                />
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    {dict.consentPrefix}{" "}
                    {configurator.privacyUrl ? (
                      <a href={configurator.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                        {dict.consentLink}
                      </a>
                    ) : (
                      dict.consentLink
                    )}
                    {dict.consentSuffix}
                  </span>
                </label>
                {error && <div role="alert" style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}
                <button type="button" data-tw-primary disabled={submitting || (!demo && !consent)} onClick={submit} style={{ ...s.btnPrimary, background: accent, color: accentInk, opacity: submitting ? 0.6 : 1 }}>
                  {submitting
                    ? dict.submitting
                    : ownCopy?.ctaLabel?.trim() || (isLeadGen ? dict.requestSurveyBtn : dict.submitBtn)}
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

function Field({ label, children, mt, id }: { label?: string; children: React.ReactNode; mt?: boolean; id?: string }) {
  return (
    <div style={{ marginBottom: 16, marginTop: mt ? 4 : undefined }}>
      {label && <label htmlFor={id} style={{ display: "block", fontSize: 13.5, fontWeight: 700, marginBottom: 6, color: "var(--color-text)" }}>{label}</label>}
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
  options,
  sash,
  disabled,
  onChange,
  styles,
}: {
  dict: ReturnType<typeof getDict>;
  options: WidgetOptions;
  sash: Sash;
  disabled: boolean;
  onChange: (patch: Partial<Sash>) => void;
  styles: typeof STYLES;
}) {
  const dirDisabled = disabled || !hasOpeningDirection(sash.type);
  const hwDisabled = disabled || sash.type === "fix";
  return (
    <>
      <div style={styles.row}>
        <MiniField label={dict.openingTypeLabel} id="sash-type">
          <select id="sash-type" style={styles.select} value={sash.type} disabled={disabled} onChange={(e) => onChange({ type: e.target.value as SashType })}>
            {options.sashTypes.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
        <MiniField label={dict.directionLabel} id="sash-direction">
          <select id="sash-direction" style={styles.select} value={openingSide(sash.type, sash.direction)} disabled={dirDisabled} onChange={(e) => onChange({ direction: directionFromOpening(sash.type, e.target.value as Direction) })}>
            {dict.directions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
      </div>
      <div style={styles.row}>
        <MiniField label={dict.hardwareLabel} id="sash-hardware">
          <select id="sash-hardware" style={styles.select} value={sash.hardware} disabled={hwDisabled} onChange={(e) => onChange({ hardware: e.target.value })}>
            {options.hardware.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </MiniField>
        <MiniField label={dict.hardwareColorLabel} id="sash-hardware-color">
          <select id="sash-hardware-color" style={styles.select} value={sash.hardwareColor} disabled={hwDisabled} onChange={(e) => onChange({ hardwareColor: e.target.value })}>
            {options.hardwareColor.map(([k, v]) => (
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

function MiniField({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <label htmlFor={id} style={{ fontSize: 11.5, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 4, display: "block" }}>{label}</label>
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
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)", gap: 20, alignItems: "start" } as React.CSSProperties,
  panel: { background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  h2: { fontSize: 15, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--color-text)", margin: "0 0 16px", fontWeight: 800 } as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 } as React.CSSProperties,
  input: { width: "100%", padding: "10px 11px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 13.5, color: "var(--color-text)" } as React.CSSProperties,
  select: { width: "100%", padding: "10px 11px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: 13.5, color: "var(--color-text)" } as React.CSSProperties,
  hint: { fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 5 } as React.CSSProperties,
  check: { display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", border: "1.5px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", cursor: "pointer", fontSize: 13.5, color: "var(--color-text)" } as React.CSSProperties,
  sashCard: { border: "1.5px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", padding: 12 } as React.CSSProperties,
  typeBtn: { flex: 1, padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "center", color: "var(--color-text)" } as React.CSSProperties,
  sumRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, padding: "7px 0", borderBottom: "1px solid var(--color-border)" } as React.CSSProperties,
  btnSecondary: { width: "100%", padding: 11, borderRadius: 8, border: "1.5px solid var(--color-mint)", background: "transparent", color: "var(--color-mint-text)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--font-space-grotesk), sans-serif" } as React.CSSProperties,
  btnPrimary: { width: "100%", padding: 11, borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--tw-font, var(--font-space-grotesk), sans-serif)" } as React.CSSProperties,
  iconBtn: { width: 22, height: 22, borderRadius: "50%", border: "none", background: "var(--color-bg-alt)", color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1, cursor: "pointer", flexShrink: 0 } as React.CSSProperties,
};
