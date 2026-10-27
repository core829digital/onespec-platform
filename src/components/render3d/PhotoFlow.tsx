"use client";

/**
 * The photo and measure part of the studio, as a sheet over the 3D: step 1 the size (typed, or measured from the photo against a card, an
 * A4 sheet or one known dimension), step 2 the photo of the old window with its four corners. When it is done the 3D shows the new window
 * on that photo. The photo stays on the device (an object URL), nothing is uploaded.
 */
import { useMemo, useRef, useState } from "react";
import { A4_MM, CARD_MM, estimateRectangle, isValidQuad, measureQuadAgainstReference, type PhotoSize, type Quad } from "@/lib/render3d/geometry";
import { detectPhotoQuad } from "@/lib/render3d/detect-photo";
import { loadPhoto, releasePhoto, type LoadedPhoto } from "@/lib/render3d/photo";
import { render3dText } from "@/lib/render3d/render3d-text";
import { render3dUi } from "@/lib/render3d/render3d-ui-text";
import { defaultQuad, PhotoMarker } from "./PhotoMarker";
import { Btn, cardStyle, fill, inputStyle } from "./studio-ui";

type RefKind = "card" | "a4" | "width" | "height";
type Step = "measure" | "photo";

export interface PhotoFlowProps {
  lang: string;
  accent: string;
  size: { widthMm: number; heightMm: number };
  limits: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
  onSize: (widthMm: number, heightMm: number) => void;
  photo: LoadedPhoto | null;
  quad: Quad | null;
  onPhoto: (photo: LoadedPhoto | null, quad: Quad | null) => void;
  onQuad: (q: Quad) => void;
  /** Back to the 3D with what has been marked. */
  onDone: () => void;
}

export function PhotoFlow({ lang, accent, size, limits, onSize, photo, quad, onPhoto, onQuad, onDone }: PhotoFlowProps) {
  const t = render3dText(lang);
  const ui = render3dUi(lang);
  const [step, setStep] = useState<Step>(photo ? "photo" : "measure");
  const [photoError, setPhotoError] = useState(false);
  const [refKind, setRefKind] = useState<RefKind>("card");
  const [refQuad, setRefQuad] = useState<Quad | null>(() => (photo ? defaultQuad(photo, 0.38) : null));
  const [known, setKnown] = useState("");
  // What is being typed; null = show the size of the configuration (so a change made elsewhere shows up here).
  const [wEdit, setWEdit] = useState<string | null>(null);
  const [hEdit, setHEdit] = useState<string | null>(null);
  const wText = wEdit ?? String(size.widthMm);
  const hText = hEdit ?? String(size.heightMm);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [autoFound, setAutoFound] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = await loadPhoto(file);
      releasePhoto(photo);
      // The markers start on the opening the program finds in the photo (matched to the typed size); if it finds nothing, on a default frame.
      const found = await detectPhotoQuad(p, size.widthMm / size.heightMm);
      const start = found && isValidQuad(found.quad) ? found.quad : defaultQuad(p);
      onPhoto(p, start);
      setAutoFound(!!found && start === found.quad);
      setRefQuad(defaultQuad(p, 0.38));
      setPhotoError(false);
      setStep("photo");
    } catch {
      setPhotoError(true);
    }
  };

  const photoSize = useMemo<PhotoSize | null>(() => (photo ? { width: photo.width, height: photo.height } : null), [photo]);
  const quadOk = !!quad && isValidQuad(quad);
  const estimate = useMemo(() => (quadOk && photoSize ? estimateRectangle(quad!, photoSize) : null), [quadOk, quad, photoSize]);

  const commitSize = () => {
    const w = Math.round(Number(wText.replace(",", ".")));
    const h = Math.round(Number(hText.replace(",", ".")));
    if (Number.isFinite(w) && Number.isFinite(h) && w >= limits.minWidth && w <= limits.maxWidth && h >= limits.minHeight && h <= limits.maxHeight) {
      onSize(w, h);
      setWEdit(null);
      setHEdit(null);
    }
  };
  const wBad = !(Number(wText) >= limits.minWidth && Number(wText) <= limits.maxWidth);
  const hBad = !(Number(hText) >= limits.minHeight && Number(hText) <= limits.maxHeight);

  const measured = useMemo(() => {
    if (!photoSize || !quadOk) return null;
    if (refKind === "card" || refKind === "a4") {
      if (!refQuad || !isValidQuad(refQuad)) return null;
      const m = measureQuadAgainstReference(refQuad, refKind === "card" ? CARD_MM : A4_MM, quad!);
      return m ? { w: Math.round(m.widthMm), h: Math.round(m.heightMm), skew: m.skew } : null;
    }
    if (!estimate) return null;
    const v = Number(known.replace(",", "."));
    if (!(v > 0)) return null;
    return refKind === "width" ? { w: Math.round(v), h: Math.round(v / estimate.aspect), skew: 0 } : { w: Math.round(v * estimate.aspect), h: Math.round(v), skew: 0 };
  }, [photoSize, quadOk, quad, refKind, refQuad, estimate, known]);
  const measuredInRange = !!measured && measured.w >= limits.minWidth && measured.w <= limits.maxWidth && measured.h >= limits.minHeight && measured.h <= limits.maxHeight;
  const mismatch = !!estimate && Math.abs(Math.log(estimate.aspect / (size.widthMm / size.heightMm))) > 0.12;

  const photoButtons = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Btn primary accent={accent} onClick={() => cameraInput.current?.click()} testId="r3d-take">{t.takePhoto}</Btn>
      <Btn accent={accent} onClick={() => galleryInput.current?.click()} testId="r3d-choose">{t.choosePhoto}</Btn>
    </div>
  );
  const muted = "var(--color-text-secondary, #6b7280)";

  return (
    <div data-testid="r3d-photoflow" style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 12 }}>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden data-testid="r3d-camera" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galleryInput} type="file" accept="image/*" hidden data-testid="r3d-gallery" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Btn accent={accent} onClick={onDone} testId="r3d-photo-back">← {t.step3d}</Btn>
        <div role="tablist" aria-label={ui.groups.photo} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["measure", "photo"] as const).map((s, i) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={step === s}
              data-testid={`r3d-step-${s}`}
              onClick={() => setStep(s)}
              style={{ minHeight: 44, padding: "6px 14px", borderRadius: 999, fontSize: 13.5, fontWeight: 650, cursor: "pointer", border: `1.5px solid ${step === s ? accent : "var(--color-border, #d1d5db)"}`, background: step === s ? "var(--color-mint-light, #ecfdf5)" : "#fff", color: "#111827" }}
            >
              {i + 1}. {s === "measure" ? t.stepMeasure : t.stepPhoto}
            </button>
          ))}
        </div>
      </div>
      {photoError ? <p role="alert" style={{ color: "#b91c1c", fontSize: 13.5, margin: 0 }}>{t.photoError}</p> : null}

      {step === "measure" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t.measureTitle}</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 600 }}>{t.measureManual}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                {t.width} ({t.mm})
                <input style={{ ...inputStyle, borderColor: wBad ? "#b91c1c" : undefined }} inputMode="numeric" data-testid="r3d-width" value={wText} onChange={(e) => setWEdit(e.target.value)} onBlur={commitSize} onKeyDown={(e) => e.key === "Enter" && commitSize()} aria-invalid={wBad} />
                <span style={{ fontWeight: 400, fontSize: 12, color: wBad ? "#b91c1c" : muted }}>{fill(t.limits, { min: limits.minWidth, max: limits.maxWidth })}</span>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                {t.height} ({t.mm})
                <input style={{ ...inputStyle, borderColor: hBad ? "#b91c1c" : undefined }} inputMode="numeric" data-testid="r3d-height" value={hText} onChange={(e) => setHEdit(e.target.value)} onBlur={commitSize} onKeyDown={(e) => e.key === "Enter" && commitSize()} aria-invalid={hBad} />
                <span style={{ fontWeight: 400, fontSize: 12, color: hBad ? "#b91c1c" : muted }}>{fill(t.limits, { min: limits.minHeight, max: limits.maxHeight })}</span>
              </label>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t.measureFromPhoto}</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: muted }}>{t.measureFromPhotoHint}</p>
            {!photo || !quadOk ? (
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13.5 }}>{t.needPhoto}</p>
                {photo ? <Btn accent={accent} onClick={() => setStep("photo")}>{t.stepPhoto} →</Btn> : photoButtons}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>{t.refTitle}</p>
                <div role="group" aria-label={t.refTitle} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["card", "a4", "width", "height"] as const).map((k) => (
                    <Btn key={k} accent={accent} ariaPressed={refKind === k} onClick={() => setRefKind(k)} testId={`r3d-ref-${k}`}>
                      {k === "card" ? t.refCard : k === "a4" ? t.refA4 : k === "width" ? t.refWidth : t.refHeight}
                    </Btn>
                  ))}
                </div>
                {refKind === "card" || refKind === "a4" ? (
                  refQuad ? <PhotoMarker photo={photo} quad={refQuad} onChange={setRefQuad} cornerLabels={t.corner} hint={refKind === "card" ? t.refHintCard : t.refHintA4} color="#2563eb" /> : null
                ) : (
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    {t.refValue} ({t.mm})
                    <input style={inputStyle} inputMode="numeric" data-testid="r3d-known" value={known} onChange={(e) => setKnown(e.target.value)} />
                    <span style={{ fontWeight: 400, fontSize: 12, color: muted }}>{t.refHintKnown}</span>
                  </label>
                )}
                {measured ? (
                  <div data-testid="r3d-measured" style={{ borderRadius: 10, padding: 12, border: `1.5px solid ${accent}`, background: "var(--color-mint-light, #ecfdf5)" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 650 }}>{t.measureResult}</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{measured.w} × {measured.h} {t.mm}</div>
                    {measured.skew > 0.06 ? <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#92400e" }}>{t.measureQualityBad}</p> : null}
                    {!measuredInRange ? <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#b91c1c" }}>{t.measureOutOfRange}</p> : null}
                    <div style={{ marginTop: 8 }}>
                      <Btn primary accent={accent} disabled={!measuredInRange} testId="r3d-use-measure" onClick={() => { onSize(measured.w, measured.h); setWEdit(null); setHEdit(null); }}>{t.measureUse}</Btn>
                    </div>
                  </div>
                ) : null}
                <p style={{ margin: 0, fontSize: 12, color: muted }}>{t.measureDisclaimer}</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn accent={accent} onClick={onDone}>{t.step3d}</Btn>
            <Btn primary accent={accent} onClick={() => setStep("photo")} testId="r3d-next-photo">{t.next} →</Btn>
          </div>
        </div>
      )}

      {step === "photo" && (
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{photo ? t.markTitle : t.photoTitle}</h3>
          {!photo || !quad ? (
            <div style={cardStyle}>
              <p style={{ margin: "0 0 10px", fontSize: 13.5 }}>{t.photoHint}</p>
              {photoButtons}
              <p style={{ margin: "10px 0 0", fontSize: 12, color: muted }}>{t.photoPrivacy}</p>
            </div>
          ) : (
            <>
              <PhotoMarker photo={photo} quad={quad} onChange={onQuad} cornerLabels={t.corner} hint={t.markHint} color={accent} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Btn accent={accent} onClick={() => { onQuad(defaultQuad(photo)); setAutoFound(false); }}>{t.resetCorners}</Btn>
                <Btn accent={accent} onClick={() => cameraInput.current?.click()}>{t.changePhoto}</Btn>
                <Btn accent={accent} onClick={() => { releasePhoto(photo); onPhoto(null, null); setStep("measure"); }} testId="r3d-photo-remove">{ui.photoRemove}</Btn>
              </div>
              <span style={{ fontSize: 12, color: muted }}>{t.photoPrivacy}</span>
              {autoFound ? <p role="status" data-testid="r3d-autocorners" style={{ margin: 0, fontSize: 12.5, color: muted }}>{ui.autoCorners}</p> : null}
              {mismatch ? <p role="status" data-testid="r3d-mismatch" style={{ margin: 0, fontSize: 12.5, color: "#92400e" }}>{t.mismatch}</p> : null}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <Btn accent={accent} onClick={() => setStep("measure")}>← {t.back}</Btn>
            <Btn primary accent={accent} disabled={!photo || !quadOk} onClick={onDone} testId="r3d-next-view">{t.step3d} →</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
