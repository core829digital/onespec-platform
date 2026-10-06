"use client";

import { useEffect, useMemo, useState } from "react";
import { getDict } from "./widget-i18n";
import { readableInk, isSafeColor, resolveFontStack } from "./widget-theme";
import { postToHost, readHostTheme } from "./host-bridge";
import { getTurnstileToken } from "@/lib/turnstile-client";
import { postQuote } from "./post-quote";
import {
  buildWizardItem,
  buildWizardNotes,
  submitErrorMessage,
  wizardCopy,
  wizardLang,
  wizardMarket,
  COLOUR_KEYS,
  FRAME_KEYS,
  GLAZING_KEYS,
  PRODUCT_KEYS,
  type ColourKey,
  type FrameKey,
  type GlazingKey,
  type IncentiveKey,
  type ProductKey,
  type WorkKey,
} from "./simple-wizard-model";

export interface SimpleWizardWidgetProps {
  configurator: {
    publicId: string;
    name: string;
    branding?: {
      colorAccent?: string;
      colorAccentInk?: string | null;
      fontFamily?: string;
      logoUrl?: string | null;
      /** Server-resolved: the owner enabled white-label AND the plan includes it. */
      whiteLabel?: boolean;
      /** Owner-written headline / subheadline / CTA per widget language (Branding tab). */
      copy?: Record<string, { headline?: string; subheadline?: string; ctaLabel?: string } | undefined>;
    };
    privacyUrl?: string | null;
    /** Widget owner's market (server-resolved from the tenant country). */
    region?: string;
  };
  theme: string;
  lang: string;
  preview: boolean;
  accentOverride?: string;
  fontOverride?: string;
}

interface HostTheme {
  accent?: string;
  bg?: string;
  font?: string;
}

const CONVEX_SITE =
  (process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string) ||
  (process.env.NEXT_PUBLIC_CONVEX_URL as string)?.replace(".convex.cloud", ".convex.site") ||
  "";

export function SimpleWizardWidget({
  configurator,
  theme,
  lang,
  preview,
  accentOverride,
  fontOverride,
}: SimpleWizardWidgetProps) {
  const dict = getDict(lang);
  const copy = wizardCopy(lang);
  const market = wizardMarket(configurator.region);
  // Owner's custom texts for this language; blank fields keep the defaults.
  const ownCopy = configurator.branding?.copy?.[lang];

  const [hostTheme, setHostTheme] = useState<HostTheme>({});
  const accent = useMemo(() => {
    const candidates = [hostTheme.accent, accentOverride, configurator.branding?.colorAccent, "#0056b3"];
    return candidates.find((c) => isSafeColor(c)) ?? "#0056b3";
  }, [hostTheme.accent, accentOverride, configurator.branding?.colorAccent]);
  const accentInk = useMemo(() => {
    const configured = configurator.branding?.colorAccentInk;
    return isSafeColor(configured) ? (configured as string) : readableInk(accent);
  }, [configurator.branding?.colorAccentInk, accent]);
  const fontStack = useMemo(
    () => resolveFontStack(hostTheme.font || fontOverride || configurator.branding?.fontFamily),
    [hostTheme.font, fontOverride, configurator.branding?.fontFamily],
  );

  useEffect(() => {
    const apply = (t: "light" | "dark") => document.documentElement.setAttribute("data-theme", t);
    if (theme === "light" || theme === "dark") {
      apply(theme);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => apply(mq.matches ? "light" : "dark");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [theme]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".tw-widget-root") ?? document.documentElement;
    root.style.setProperty("--tw-accent", accent);
    root.style.setProperty("--tw-accent-ink", accentInk);
    root.style.setProperty("--tw-font", fontStack);
  }, [accent, accentInk, fontStack]);

  useEffect(() => {
    function post() {
      postToHost({ type: "onespec:resize", publicId: configurator.publicId, height: document.body.scrollHeight });
    }
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    postToHost({ type: "onespec:ready", publicId: configurator.publicId });
    function onMessage(e: MessageEvent) {
      const t = readHostTheme(e);
      if (t) setHostTheme(t);
    }
    window.addEventListener("message", onMessage);
    return () => {
      ro.disconnect();
      window.removeEventListener("message", onMessage);
    };
  }, [configurator.publicId]);

  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [work, setWork] = useState<WorkKey | "">("");
  const [product, setProduct] = useState<ProductKey | "">("");
  const [larghezza, setLarghezza] = useState("");
  const [altezza, setAltezza] = useState("");
  const [colour, setColour] = useState<ColourKey | "">("");
  const [glazing, setGlazing] = useState<GlazingKey>("double");
  const [frame, setFrame] = useState<FrameKey>("straight");
  const [smaltimento, setSmaltimento] = useState(false);
  const [posa, setPosa] = useState(true);
  const [incentive, setIncentive] = useState<IncentiveKey | "">("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cap, setCap] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [stepError, setStepError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  function validateStep(): boolean {
    setStepError("");
    if (step === 1 && !work) {
      setStepError(copy.errWork);
      return false;
    }
    if (step === 2 && !product) {
      setStepError(copy.errProduct);
      return false;
    }
    if (step === 3 && !colour) {
      setStepError(copy.errColour);
      return false;
    }
    return true;
  }

  async function goNext() {
    if (!validateStep()) return;
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }
    await submit();
  }

  function goBack() {
    setStepError("");
    if (step > 1) setStep(step - 1);
  }

  async function submit() {
    setSubmitError("");
    if (!nome.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setSubmitError(dict.leadError);
      return;
    }
    if (!telefono.trim() || !cap.trim()) {
      setSubmitError(copy.errRequired);
      return;
    }
    if (!consent) {
      setSubmitError(dict.consentRequired);
      return;
    }
    if (!work || !product || !colour) return;
    const selection = {
      work,
      product,
      widthCm: larghezza,
      heightCm: altezza,
      colour,
      glazing,
      frame,
      disposal: smaltimento,
      installation: posa,
      incentive,
      postal: cap.trim(),
    };
    const notes = buildWizardNotes(selection, market);
    const notesCopy = wizardCopy(market.notesLang);
    const item = buildWizardItem(selection, notes);

    setSubmitting(true);
    try {
      const turnstileToken = await getTurnstileToken();
      const body = {
        publicId: configurator.publicId,
        items: [item],
        leadName: nome.trim(),
        leadEmail: email.trim(),
        leadPhone: telefono.trim(),
        leadMessage: `${notesCopy.notes.postal}: ${cap.trim()}\n\n${notes}`.slice(0, 2000),
        leadLocale: wizardLang(lang),
        honeypot: honeypot || undefined,
        consent: true as const,
        consentVersion: "wizard-1",
        turnstileToken: turnstileToken ?? undefined,
      };
      const data = await postQuote(`${CONVEX_SITE}/api/widget/quote`, body);
      if (data.ok) {
        setDone(true);
        postToHost({ type: "onespec:submitted", publicId: configurator.publicId });
      } else {
        setSubmitError(submitErrorMessage(copy, data.error));
      }
    } catch {
      setSubmitError(copy.errors.GENERIC);
    } finally {
      setSubmitting(false);
    }
  }

  const s = STYLES;
  const cards = <T extends string>(
    options: Array<{ value: T; label: string }>,
    value: T,
    onChange: (v: T) => void,
  ) => (
    <div style={s.grid}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{ ...s.card, ...(value === o.value ? s.cardSelected : {}) }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  if (done) {
    return (
      <div className="tw-widget-root" style={s.wrap}>
        <div style={{ ...s.panel, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 34, marginBottom: 8, color: "#28a745" }}>✓</div>
          <h3 style={{ margin: "0 0 8px" }}>{copy.successTitle}</h3>
          <p style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {copy.successBody.replace("{name}", nome)}
          </p>
        </div>
      </div>
    );
  }

  const installationLabel = market.installationNorm
    ? `${copy.installation} (${market.installationNorm})`
    : copy.installation;

  return (
    <div className="tw-widget-root" style={s.wrap}>
      <div style={s.header}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>{ownCopy?.headline?.trim() || copy.title}</h2>
        {ownCopy?.subheadline?.trim() ? (
          <p style={{ margin: "0 0 4px", fontSize: "0.8rem", opacity: 0.85 }}>{ownCopy.subheadline.trim()}</p>
        ) : null}
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9 }}>{copy.steps[step - 1]}</p>
      </div>
      <div style={s.progressTrack}>
        <div style={{ ...s.progressBar, width: `${(step / totalSteps) * 100}%` }} />
      </div>
      <div style={s.body}>
        {step === 1 &&
          cards<WorkKey | "">(
            [
              { value: "renovation", label: copy.work.renovation },
              { value: "new", label: copy.work.new },
            ],
            work,
            setWork,
          )}

        {step === 2 && (
          <div>
            <label style={s.label} htmlFor="wizard-tipologia">{copy.productLabel}</label>
            <select
              id="wizard-tipologia"
              style={s.input}
              value={product}
              onChange={(e) => setProduct(e.target.value as ProductKey | "")}
            >
              <option value="">{copy.productPlaceholder}</option>
              {PRODUCT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {copy.products[k]}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label} htmlFor="wizard-larghezza">{copy.width}</label>
                <input id="wizard-larghezza" style={s.input} type="number" min={30} max={600} inputMode="numeric" placeholder="120" value={larghezza} onChange={(e) => setLarghezza(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label} htmlFor="wizard-altezza">{copy.height}</label>
                <input id="wizard-altezza" style={s.input} type="number" min={30} max={400} inputMode="numeric" placeholder="140" value={altezza} onChange={(e) => setAltezza(e.target.value)} />
              </div>
            </div>
            <p style={s.disclaimer}>{copy.measureDisclaimer}</p>
          </div>
        )}

        {step === 3 && (
          <div>
            <label style={s.label}>{copy.colourLabel}</label>
            {cards<ColourKey | "">(
              COLOUR_KEYS.map((k) => ({ value: k, label: copy.colours[k] })),
              colour,
              setColour,
            )}
            <div style={{ marginTop: 14 }}>
              <label style={s.label} htmlFor="wizard-vetro">{copy.glazingLabel}</label>
              <select id="wizard-vetro" style={s.input} value={glazing} onChange={(e) => setGlazing(e.target.value as GlazingKey)}>
                {GLAZING_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {copy.glazings[k]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={s.label} htmlFor="wizard-telaio">{copy.frameLabel}</label>
              <select id="wizard-telaio" style={s.input} value={frame} onChange={(e) => setFrame(e.target.value as FrameKey)}>
                {FRAME_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {copy.frames[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={s.checkboxLabel}>
                <input type="checkbox" checked={smaltimento} onChange={(e) => setSmaltimento(e.target.checked)} />
                {copy.disposal}
              </label>
              <label style={s.checkboxLabel}>
                <input type="checkbox" checked={posa} onChange={(e) => setPosa(e.target.checked)} />
                {installationLabel}
              </label>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={s.label} htmlFor="wizard-bonus">{copy.incentiveLabel}</label>
              <select
                id="wizard-bonus"
                style={s.input}
                value={incentive}
                onChange={(e) => setIncentive(e.target.value as IncentiveKey | "")}
              >
                <option value="">{copy.incentivePlaceholder}</option>
                {market.incentives.map((k) => (
                  <option key={k} value={k}>
                    {copy.incentives[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div style={s.summary}>
              <strong>{copy.summary}</strong>
              <br />• {work ? copy.work[work] : ""}
              <br />• {product ? copy.products[product] : ""} ({larghezza || "?"} x {altezza || "?"} cm)
              <br />• {colour ? copy.colours[colour] : ""} — {copy.glazings[glazing]} — {copy.frames[frame]}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-nome">{copy.name}</label>
              <input id="wizard-nome" style={s.input} type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder={market.placeholders.name} autoComplete="name" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-email">{copy.email}</label>
              <input id="wizard-email" style={s.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={market.placeholders.email} autoComplete="email" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-telefono">{copy.phone}</label>
              <input id="wizard-telefono" style={s.input} type="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={market.placeholders.phone} autoComplete="tel" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-cap">{copy.postal}</label>
              <input id="wizard-cap" style={s.input} type="text" required value={cap} onChange={(e) => setCap(e.target.value)} placeholder={market.placeholders.postal} autoComplete="postal-code" />
            </div>
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
              tabIndex={-1}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />
            <label style={{ ...s.checkboxLabel, background: "transparent", border: "none", padding: 0, fontSize: 12.5 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                {dict.consentPrefix}{" "}
                {configurator.privacyUrl ? (
                  <a href={configurator.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--tw-accent)" }}>
                    {dict.consentLink}
                  </a>
                ) : (
                  dict.consentLink
                )}
                {dict.consentSuffix}
              </span>
            </label>
            {submitError ? <p role="alert" style={s.error}>{submitError}</p> : null}
          </div>
        )}

        {stepError ? <p style={s.error}>{stepError}</p> : null}

        <div style={s.actions}>
          {step > 1 ? (
            <button type="button" onClick={goBack} style={s.btnPrev}>
              {copy.back}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={goNext} disabled={submitting} style={s.btnNext}>
            {submitting ? "…" : step === totalSteps ? ownCopy?.ctaLabel?.trim() || copy.send : copy.next}
          </button>
        </div>
      </div>
      {preview || configurator.branding?.whiteLabel ? null : (
        <p style={{ textAlign: "center", fontSize: 10, color: "var(--color-text-secondary)", padding: "0 0 10px" }}>
          Powered by OneSpec
        </p>
      )}
    </div>
  );
}

const STYLES = {
  wrap: {
    maxWidth: 560,
    width: "100%",
    margin: "0 auto",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    overflow: "hidden",
    color: "var(--color-text)",
    fontFamily: "var(--tw-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
  } as React.CSSProperties,
  header: {
    background: "var(--tw-accent, #0056b3)",
    color: "var(--tw-accent-ink, #fff)",
    padding: "16px 15px",
    textAlign: "center",
  } as React.CSSProperties,
  panel: { padding: 20 } as React.CSSProperties,
  progressTrack: { display: "flex", background: "var(--color-border)", height: 6 } as React.CSSProperties,
  progressBar: { background: "var(--tw-accent, #0056b3)", transition: "width 0.3s ease" } as React.CSSProperties,
  body: { padding: "20px 15px" } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 } as React.CSSProperties,
  card: {
    border: "2px solid var(--color-border)",
    borderRadius: 8,
    padding: "14px 8px",
    textAlign: "center",
    cursor: "pointer",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    fontSize: 13.5,
    fontFamily: "inherit",
  } as React.CSSProperties,
  cardSelected: { borderColor: "var(--tw-accent, #0056b3)", background: "var(--color-bg-alt)", fontWeight: 600 } as React.CSSProperties,
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "11px 10px",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 15,
    background: "var(--color-bg)",
    color: "var(--color-text)",
  } as React.CSSProperties,
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13.5,
    cursor: "pointer",
    background: "var(--color-bg-alt)",
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--color-border)",
  } as React.CSSProperties,
  summary: {
    background: "var(--color-bg-alt)",
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 15,
    borderLeft: "4px solid var(--tw-accent, #0056b3)",
    lineHeight: 1.5,
  } as React.CSSProperties,
  disclaimer: { fontSize: 11.5, color: "var(--color-text-secondary)", marginTop: 6 } as React.CSSProperties,
  actions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 15,
    borderTop: "1px solid var(--color-border)",
  } as React.CSSProperties,
  btnPrev: { padding: "12px 20px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg-alt)", color: "var(--color-text)", fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
  btnNext: { padding: "12px 22px", borderRadius: 8, border: "none", background: "var(--tw-accent, #0056b3)", color: "var(--tw-accent-ink, #fff)", fontWeight: 600, cursor: "pointer", marginLeft: "auto" } as React.CSSProperties,
  error: { color: "var(--color-danger, #dc2626)", fontSize: 12.5, marginTop: 10 } as React.CSSProperties,
};
