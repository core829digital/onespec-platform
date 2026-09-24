"use client";

import { useEffect, useMemo, useState } from "react";
import { getDict } from "./widget-i18n";
import { readableInk, isSafeColor, resolveFontStack } from "./widget-theme";
import { postToHost, readHostTheme } from "./host-bridge";
import { getTurnstileToken } from "@/lib/turnstile-client";
import type { PieceCategory } from "@/shared/configurator-model";

export interface SimpleWizardWidgetProps {
  configurator: {
    publicId: string;
    name: string;
    branding?: {
      colorAccent?: string;
      colorAccentInk?: string | null;
      fontFamily?: string;
      logoUrl?: string | null;
    };
    privacyUrl?: string | null;
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

type Intervento = "Sostituzione/Ristrutturazione" | "Nuova Costruzione" | "";
type Colore = "Bianco Standard" | "Effetto Legno" | "Tinta Unita / RAL" | "";

const TIPOLOGIA_TO_CATEGORY: Record<string, { category: PieceCategory; productType: "window" | "balconyDoor"; sashType: "classic" | "sliding" }> = {
  "Finestra 1 Anta": { category: "finestra1", productType: "window", sashType: "classic" },
  "Finestra 2 Ante": { category: "finestra2", productType: "window", sashType: "classic" },
  "Porta-Finestra": { category: "porta1", productType: "balconyDoor", sashType: "classic" },
  "Scorrevole (HST/HKS)": { category: "scorrevole", productType: "balconyDoor", sashType: "sliding" },
  "Persiana / Scuro": { category: "pannello", productType: "window", sashType: "classic" },
};

const COLORE_SLUG: Record<string, string> = {
  "Bianco Standard": "white",
  "Effetto Legno": "woodgrain",
  "Tinta Unita / RAL": "custom",
};

const STEP_COPY: Record<string, { title: string; steps: string[]; next: string; send: string; back: string }> = {
  it: {
    title: "Preventivo Infissi in PVC",
    steps: [
      "1. Tipo di intervento",
      "2. Tipologia e dimensioni approssimative",
      "3. Finitura e prestazioni energetiche",
      "4. Servizi e agevolazioni fiscali",
      "5. Dove possiamo inviare la stima?",
    ],
    next: "Avanti",
    send: "Invia richiesta",
    back: "Indietro",
  },
  en: {
    title: "PVC Window Quote",
    steps: [
      "1. Type of work",
      "2. Product type and approximate size",
      "3. Finish and energy performance",
      "4. Services and tax incentives",
      "5. Where should we send the estimate?",
    ],
    next: "Next",
    send: "Send request",
    back: "Back",
  },
};

function copyFor(lang: string) {
  return STEP_COPY[lang] ?? STEP_COPY.it;
}

export function SimpleWizardWidget({
  configurator,
  theme,
  lang,
  preview,
  accentOverride,
  fontOverride,
}: SimpleWizardWidgetProps) {
  const dict = getDict(lang);
  const copy = copyFor(lang);

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
  const [intervento, setIntervento] = useState<Intervento>("");
  const [tipologia, setTipologia] = useState("");
  const [larghezza, setLarghezza] = useState("");
  const [altezza, setAltezza] = useState("");
  const [colore, setColore] = useState<Colore>("");
  const [vetro, setVetro] = useState("Doppio Vetro (Standard)");
  const [telaio, setTelaio] = useState("Telaio Dritto (Standard)");
  const [smaltimento, setSmaltimento] = useState(false);
  const [posa, setPosa] = useState(true);
  const [bonus, setBonus] = useState("Nessuno / Non specificato");
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
    if (step === 1 && !intervento) {
      setStepError(lang === "en" ? "Select the type of work to continue." : "Seleziona il tipo di intervento per proseguire.");
      return false;
    }
    if (step === 2 && !tipologia) {
      setStepError(lang === "en" ? "Select a product type." : "Seleziona la tipologia di prodotto.");
      return false;
    }
    if (step === 3 && !colore) {
      setStepError(lang === "en" ? "Select a colour to continue." : "Seleziona un colore per proseguire.");
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
      setSubmitError(lang === "en" ? "Please fill in every required field." : "Compila tutti i campi obbligatori.");
      return;
    }
    if (!consent) {
      setSubmitError(dict.consentRequired);
      return;
    }
    const map = TIPOLOGIA_TO_CATEGORY[tipologia] ?? { category: "finestra1" as PieceCategory, productType: "window" as const, sashType: "classic" as const };
    const widthMm = Math.min(1200, Math.max(200, (parseInt(larghezza, 10) || 120) * 10));
    const heightMm = Math.min(2800, Math.max(200, (parseInt(altezza, 10) || 140) * 10));
    const notes = [
      `Intervento: ${intervento}`,
      `Prodotto: ${tipologia} — misura indicata dal cliente: ${larghezza || "?"} x ${altezza || "?"} cm`,
      `Colore: ${colore}`,
      `Vetro: ${vetro}`,
      `Telaio: ${telaio}`,
      `Smaltimento vecchi infissi: ${smaltimento ? "sì" : "no"}`,
      `Posa qualificata richiesta: ${posa ? "sì" : "no"}`,
      `Agevolazione fiscale: ${bonus}`,
    ].join("\n");

    const item = {
      productType: map.productType,
      category: map.category,
      material: "pvc",
      quality: {},
      width: widthMm,
      height: heightMm,
      quantity: 1,
      sashes: [
        {
          type: map.sashType,
          direction: "left" as const,
          active: true,
          main: true,
          hardware: "standard",
          hardwareColor: COLORE_SLUG[colore] ?? "white",
        },
      ],
      glazing: vetro.startsWith("Triplo") ? "triple" : "double",
      color: COLORE_SLUG[colore] ?? "white",
      insectScreen: false,
      notes: notes.slice(0, 500),
    };

    setSubmitting(true);
    try {
      const turnstileToken = await getTurnstileToken();
      const body = {
        publicId: configurator.publicId,
        items: [item],
        leadName: nome.trim(),
        leadEmail: email.trim(),
        leadPhone: telefono.trim(),
        leadMessage: `CAP/Comune intervento: ${cap.trim()}\n\n${notes}`.slice(0, 2000),
        leadLocale: (["it", "en", "fr", "nl", "de"].includes(lang) ? lang : "it") as "it" | "en" | "fr" | "nl" | "de",
        honeypot: honeypot || undefined,
        consent: true as const,
        consentVersion: "wizard-1",
        turnstileToken: turnstileToken ?? undefined,
      };
      const res = await fetch(`${CONVEX_SITE}/api/widget/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "BAD_RESPONSE" }));
      if (res.ok && data.ok) {
        setDone(true);
        postToHost({ type: "onespec:submitted", publicId: configurator.publicId });
      } else {
        setSubmitError(typeof data.error === "string" ? data.error : "SUBMIT_FAILED");
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "NETWORK_ERROR");
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
          <h3 style={{ margin: "0 0 8px" }}>
            {lang === "en" ? "Request sent successfully!" : "Richiesta inviata con successo!"}
          </h3>
          <p style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {lang === "en"
              ? `Thank you ${nome}. We'll get back to you within 24 working hours with your estimate.`
              : `Grazie ${nome}. Ti contatteremo entro 24 ore lavorative con la stima dettagliata.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tw-widget-root" style={s.wrap}>
      <div style={s.header}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>{copy.title}</h2>
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9 }}>{copy.steps[step - 1]}</p>
      </div>
      <div style={s.progressTrack}>
        <div style={{ ...s.progressBar, width: `${(step / totalSteps) * 100}%` }} />
      </div>
      <div style={s.body}>
        {step === 1 &&
          cards<Intervento>(
            [
              { value: "Sostituzione/Ristrutturazione", label: lang === "en" ? "Replacement / Renovation" : "Sostituzione / Ristrutturazione" },
              { value: "Nuova Costruzione", label: lang === "en" ? "New Construction" : "Nuova Costruzione" },
            ],
            intervento,
            setIntervento,
          )}

        {step === 2 && (
          <div>
            <label style={s.label} htmlFor="wizard-tipologia">{lang === "en" ? "Product type" : "Tipologia Prodotto"}</label>
            <select id="wizard-tipologia" style={s.input} value={tipologia} onChange={(e) => setTipologia(e.target.value)}>
              <option value="">{lang === "en" ? "Select a type…" : "Seleziona una tipologia…"}</option>
              {Object.keys(TIPOLOGIA_TO_CATEGORY).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label} htmlFor="wizard-larghezza">{lang === "en" ? "Width (cm)" : "Larghezza (cm)"}</label>
                <input id="wizard-larghezza" style={s.input} type="number" min={30} max={600} inputMode="numeric" placeholder="120" value={larghezza} onChange={(e) => setLarghezza(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label} htmlFor="wizard-altezza">{lang === "en" ? "Height (cm)" : "Altezza (cm)"}</label>
                <input id="wizard-altezza" style={s.input} type="number" min={30} max={400} inputMode="numeric" placeholder="140" value={altezza} onChange={(e) => setAltezza(e.target.value)} />
              </div>
            </div>
            <p style={s.disclaimer}>
              {lang === "en"
                ? "* Final measurements will be taken during the technical survey."
                : "* Le misure definitive saranno rilevate durante il sopralluogo tecnico."}
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <label style={s.label}>{lang === "en" ? "Profile colour" : "Colore Profilo"}</label>
            {cards<Colore>(
              [
                { value: "Bianco Standard", label: lang === "en" ? "Standard White" : "Bianco Standard" },
                { value: "Effetto Legno", label: lang === "en" ? "Wood Effect" : "Effetto Legno" },
                { value: "Tinta Unita / RAL", label: lang === "en" ? "Solid Colour / RAL" : "Tinta Unita / RAL" },
              ],
              colore,
              setColore,
            )}
            <div style={{ marginTop: 14 }}>
              <label style={s.label} htmlFor="wizard-vetro">{lang === "en" ? "Glazing" : "Tipologia Vetro"}</label>
              <select id="wizard-vetro" style={s.input} value={vetro} onChange={(e) => setVetro(e.target.value)}>
                <option value="Doppio Vetro (Standard)">{lang === "en" ? "Double Glazing (Standard)" : "Doppio Vetro (Isolamento Standard)"}</option>
                <option value="Triplo Vetro (Alta Efficienza)">{lang === "en" ? "Triple Glazing (High Efficiency)" : "Triplo Vetro (Massimo Isolamento)"}</option>
              </select>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={s.label} htmlFor="wizard-telaio">{lang === "en" ? "Frame type" : "Tipologia Telaio"}</label>
              <select id="wizard-telaio" style={s.input} value={telaio} onChange={(e) => setTelaio(e.target.value)}>
                <option value="Telaio Dritto (Standard)">{lang === "en" ? "Straight Frame (Standard)" : "Telaio Dritto (Standard)"}</option>
                <option value="Telaio di Ristrutturazione Aletta 40mm">{lang === "en" ? "Renovation Frame 40mm" : "Telaio di Ristrutturazione Aletta 40mm"}</option>
                <option value="Telaio di Ristrutturazione Aletta 65mm">{lang === "en" ? "Renovation Frame 65mm" : "Telaio di Ristrutturazione Aletta 65mm"}</option>
              </select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={s.checkboxLabel}>
                <input type="checkbox" checked={smaltimento} onChange={(e) => setSmaltimento(e.target.checked)} />
                {lang === "en" ? "Disposal and removal of old windows" : "Smaltimento e rimozione vecchi infissi"}
              </label>
              <label style={s.checkboxLabel}>
                <input type="checkbox" checked={posa} onChange={(e) => setPosa(e.target.checked)} />
                {lang === "en" ? "Qualified installation (UNI 11673)" : "Posa in opera qualificata (UNI 11673)"}
              </label>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={s.label} htmlFor="wizard-bonus">{lang === "en" ? "Interested in tax incentives" : "Interesse Agevolazioni Fiscali"}</label>
              <select id="wizard-bonus" style={s.input} value={bonus} onChange={(e) => setBonus(e.target.value)}>
                <option value="Nessuno / Non specificato">{lang === "en" ? "Select an option…" : "Seleziona un'opzione…"}</option>
                <option value="Bonus Casa (50%)">{lang === "en" ? "Home Bonus (Renovation)" : "Bonus Casa (Ristrutturazione)"}</option>
                <option value="Ecobonus (50%)">{lang === "en" ? "Ecobonus (Energy Efficiency)" : "Ecobonus (Riqualificazione Energetica)"}</option>
                <option value="Richiesta informazioni">{lang === "en" ? "I'd like advice on active incentives" : "Vorrei consulenza sui bonus attivi"}</option>
              </select>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div style={s.summary}>
              <strong>{lang === "en" ? "Selection summary:" : "Riepilogo selezione:"}</strong>
              <br />• {intervento}
              <br />• {tipologia} ({larghezza || "?"} x {altezza || "?"} cm)
              <br />• {colore} — {vetro} — {telaio}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-nome">{lang === "en" ? "Full name *" : "Nome e Cognome *"}</label>
              <input id="wizard-nome" style={s.input} type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Mario Rossi" autoComplete="name" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-email">{lang === "en" ? "Email *" : "Email *"}</label>
              <input id="wizard-email" style={s.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mario.rossi@email.it" autoComplete="email" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-telefono">{lang === "en" ? "Phone *" : "Telefono *"}</label>
              <input id="wizard-telefono" style={s.input} type="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="333 1234567" autoComplete="tel" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label} htmlFor="wizard-cap">{lang === "en" ? "Postal code / town *" : "CAP / Comune dell'intervento *"}</label>
              <input id="wizard-cap" style={s.input} type="text" required value={cap} onChange={(e) => setCap(e.target.value)} placeholder="52044" autoComplete="postal-code" />
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
            {submitError ? <p style={s.error}>{submitError}</p> : null}
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
            {submitting ? "…" : step === totalSteps ? copy.send : copy.next}
          </button>
        </div>
      </div>
      {preview ? null : (
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
