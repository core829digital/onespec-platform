"use client";

/**
 * Measure from a photo + 3D render of the new window in the customer's home.
 * One component for the public widget and for the platform page: the owner passes the window (as the 3D model), the catalogue
 * choices and the callbacks that change the configuration, so the price and everything else stay in the owner's hands.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { openingSide, type SashKind } from "@/shared/sash-rules";
import { A4_MM, CARD_MM, estimateRectangle, isValidQuad, measureQuadAgainstReference, type PhotoSize, type Quad } from "@/lib/render3d/geometry";
import { loadPhoto, releasePhoto, type LoadedPhoto } from "@/lib/render3d/photo";
import { render3dText, type Render3DText } from "@/lib/render3d/render3d-text";
import { posesFor, type SashPose, type Window3DInput } from "@/lib/render3d/window-3d";
import { defaultQuad, PhotoMarker } from "./PhotoMarker";
import { Render3DViewer, type Render3DViewerHandle, type ViewerPhoto } from "./Render3DViewer";

export interface StudioSwatch {
  key: string;
  label: string;
  hex: string;
  textureUrl?: string;
}

export interface Render3DStudioProps {
  lang: string;
  model: Window3DInput;
  colors: StudioSwatch[];
  colorKey: string;
  onColor: (key: string) => void;
  hardware: StudioSwatch[];
  hardwareKey: string;
  onHardware: (key: string) => void;
  sashTypes: Array<{ key: SashKind; label: string }>;
  onSashType: (index: number, type: SashKind) => void;
  /** The opening side as named in the interface (see `openingSide` in sash-rules): the owner converts it to the stored direction. */
  onSashDirection: (index: number, side: "left" | "right") => void;
  limits: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
  onSize: (widthMm: number, heightMm: number) => void;
  /** Where the customer goes back to change the rest of the configuration (the widget form); absent = no such button. */
  onClose?: () => void;
  accent?: string;
}

type Step = "measure" | "photo" | "view";
type RefKind = "card" | "a4" | "width" | "height";

const card: CSSProperties = { border: "1px solid var(--color-border, #d1d5db)", borderRadius: 12, padding: 14, background: "var(--color-bg-alt, #f9fafb)" };
const input: CSSProperties = { width: "100%", minHeight: 44, borderRadius: 8, border: "1px solid var(--color-border, #d1d5db)", padding: "8px 10px", fontSize: 16, background: "var(--color-bg, #fff)", color: "var(--color-text, #111827)" };

const sizeText = (t: string, p: Record<string, string | number>) => Object.entries(p).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t);

function Btn({ children, onClick, primary, accent, disabled, testId, ariaPressed }: { children: ReactNode; onClick?: () => void; primary?: boolean; accent: string; disabled?: boolean; testId?: string; ariaPressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      data-testid={testId}
      style={{
        minHeight: 44,
        padding: "8px 16px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 650,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: `1.5px solid ${primary || ariaPressed ? accent : "var(--color-border, #d1d5db)"}`,
        background: primary ? accent : ariaPressed ? "var(--color-mint-light, #ecfdf5)" : "var(--color-bg, #fff)",
        color: primary ? "#fff" : "var(--color-text, #111827)",
      }}
    >
      {children}
    </button>
  );
}

export function Render3DStudio(props: Render3DStudioProps) {
  const { lang, model, colors, colorKey, onColor, hardware, hardwareKey, onHardware, sashTypes, onSashType, onSashDirection, limits, onSize, onClose, accent = "#16a34a" } = props;
  const t: Render3DText = render3dText(lang);
  const [step, setStep] = useState<Step>("measure");
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [refKind, setRefKind] = useState<RefKind>("card");
  const [refQuad, setRefQuad] = useState<Quad | null>(null);
  const [known, setKnown] = useState("");
  // What is being typed; null = show the size of the configuration (so a change made elsewhere shows up here).
  const [wEdit, setWEdit] = useState<string | null>(null);
  const [hEdit, setHEdit] = useState<string | null>(null);
  const wText = wEdit ?? String(model.widthMm);
  const hText = hEdit ?? String(model.heightMm);
  const setWText = setWEdit;
  const setHText = setHEdit;
  const [poses, setPoses] = useState<SashPose[]>([]);
  const [unsupported, setUnsupported] = useState(false);
  const viewer = useRef<Render3DViewerHandle>(null);
  const photoRef = useRef<LoadedPhoto | null>(null);
  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);
  useEffect(() => () => releasePhoto(photoRef.current), []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = await loadPhoto(file);
      releasePhoto(photoRef.current);
      setPhoto(p);
      setQuad(defaultQuad(p));
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

  // A focal length read from hand-placed corners is only trusted inside what a phone camera can really have.
  const focalPx = useMemo(() => {
    if (!estimate?.focalPx || !photoSize) return null;
    const side = Math.max(photoSize.width, photoSize.height);
    return estimate.focalPx >= 0.45 * side && estimate.focalPx <= 2.2 * side ? estimate.focalPx : null;
  }, [estimate, photoSize]);

  const viewerPhoto: ViewerPhoto | null = photo && quadOk ? { url: photo.url, width: photo.width, height: photo.height, quad: quad!, focalPx } : null;
  const mismatch = !!estimate && Math.abs(Math.log(estimate.aspect / (model.widthMm / model.heightMm))) > 0.12;

  // --- Poses: one per leaf, always something the leaf can do.
  const effective = useMemo(() => model.sashes.map((s, i) => (posesFor(s.type).includes(poses[i]) ? poses[i] : "closed")), [model.sashes, poses]);
  const setPose = useCallback(
    (i: number, p: SashPose) => setPoses((old) => model.sashes.map((_, k) => (k === i ? p : (old[k] ?? "closed")))),
    [model.sashes],
  );
  const tap = useCallback(
    (i: number) => {
      const s = model.sashes[i];
      if (!s) return;
      const order = posesFor(s.type);
      if (order.length < 2) return;
      const cur = effective[i];
      setPose(i, order[(order.indexOf(cur) + 1) % order.length]);
    },
    [effective, model.sashes, setPose],
  );
  const setAll = (mode: "open" | "closed") => setPoses(model.sashes.map((s) => (mode === "closed" ? "closed" : posesFor(s.type).includes("open") ? "open" : posesFor(s.type).includes("tilt") ? "tilt" : "closed")));

  // --- Measures.
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

  const save = async (share: boolean) => {
    const blob = await viewer.current?.capture();
    if (!blob) return;
    const file = new File([blob], "render-3d.jpg", { type: "image/jpeg" });
    if (share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t.title });
        return;
      } catch {
        return; // the customer closed the share sheet
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "render-3d.jpg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const stepChips = (
    <div role="tablist" aria-label={t.title} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {(["measure", "photo", "view"] as const).map((s, i) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={step === s}
          data-testid={`r3d-step-${s}`}
          onClick={() => setStep(s)}
          style={{ minHeight: 44, padding: "6px 14px", borderRadius: 999, fontSize: 13.5, fontWeight: 650, cursor: "pointer", border: `1.5px solid ${step === s ? accent : "var(--color-border, #d1d5db)"}`, background: step === s ? "var(--color-mint-light, #ecfdf5)" : "var(--color-bg, #fff)", color: "var(--color-text, #111827)" }}
        >
          {i + 1}. {s === "measure" ? t.stepMeasure : s === "photo" ? t.stepPhoto : t.step3d}
        </button>
      ))}
    </div>
  );

  const hiddenInputs = (
    <>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden data-testid="r3d-camera" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galleryInput} type="file" accept="image/*" hidden data-testid="r3d-gallery" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  const photoButtons = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Btn primary accent={accent} onClick={() => cameraInput.current?.click()} testId="r3d-take">{t.takePhoto}</Btn>
      <Btn accent={accent} onClick={() => galleryInput.current?.click()} testId="r3d-choose">{t.choosePhoto}</Btn>
    </div>
  );

  return (
    <section aria-label={t.title} data-testid="render3d-studio" style={{ color: "var(--color-text, #111827)" }}>
      {hiddenInputs}
      {stepChips}
      {photoError ? <p role="alert" style={{ color: "#b91c1c", fontSize: 13.5, margin: "0 0 10px" }}>{t.photoError}</p> : null}

      {step === "measure" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={card}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t.measureTitle}</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 600 }}>{t.measureManual}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                {t.width} ({t.mm})
                <input style={{ ...input, borderColor: wBad ? "#b91c1c" : undefined }} inputMode="numeric" data-testid="r3d-width" value={wText} onChange={(e) => setWText(e.target.value)} onBlur={commitSize} onKeyDown={(e) => e.key === "Enter" && commitSize()} aria-invalid={wBad} />
                <span style={{ fontWeight: 400, fontSize: 12, color: wBad ? "#b91c1c" : "var(--color-text-secondary, #6b7280)" }}>{sizeText(t.limits, { min: limits.minWidth, max: limits.maxWidth })}</span>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                {t.height} ({t.mm})
                <input style={{ ...input, borderColor: hBad ? "#b91c1c" : undefined }} inputMode="numeric" data-testid="r3d-height" value={hText} onChange={(e) => setHText(e.target.value)} onBlur={commitSize} onKeyDown={(e) => e.key === "Enter" && commitSize()} aria-invalid={hBad} />
                <span style={{ fontWeight: 400, fontSize: 12, color: hBad ? "#b91c1c" : "var(--color-text-secondary, #6b7280)" }}>{sizeText(t.limits, { min: limits.minHeight, max: limits.maxHeight })}</span>
              </label>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t.measureFromPhoto}</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary, #6b7280)" }}>{t.measureFromPhotoHint}</p>
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
                  refQuad ? (
                    <PhotoMarker photo={photo} quad={refQuad} onChange={setRefQuad} cornerLabels={t.corner} hint={refKind === "card" ? t.refHintCard : t.refHintA4} color="#2563eb" />
                  ) : null
                ) : (
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    {t.refValue} ({t.mm})
                    <input style={input} inputMode="numeric" data-testid="r3d-known" value={known} onChange={(e) => setKnown(e.target.value)} />
                    <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-secondary, #6b7280)" }}>{t.refHintKnown}</span>
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
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary, #6b7280)" }}>{t.measureDisclaimer}</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn primary accent={accent} onClick={() => setStep("photo")} testId="r3d-next-photo">{t.next} →</Btn>
          </div>
        </div>
      )}

      {step === "photo" && (
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{photo ? t.markTitle : t.photoTitle}</h3>
          {!photo || !quad ? (
            <div style={card}>
              <p style={{ margin: "0 0 10px", fontSize: 13.5 }}>{t.photoHint}</p>
              {photoButtons}
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary, #6b7280)" }}>{t.photoPrivacy}</p>
            </div>
          ) : (
            <>
              <PhotoMarker photo={photo} quad={quad} onChange={setQuad} cornerLabels={t.corner} hint={t.markHint} color={accent} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Btn accent={accent} onClick={() => setQuad(defaultQuad(photo))}>{t.resetCorners}</Btn>
                <Btn accent={accent} onClick={() => cameraInput.current?.click()}>{t.changePhoto}</Btn>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary, #6b7280)" }}>{t.photoPrivacy}</span>
              </div>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <Btn accent={accent} onClick={() => setStep("measure")}>← {t.back}</Btn>
            <Btn primary accent={accent} onClick={() => setStep("view")} testId="r3d-next-view">{t.next} →</Btn>
          </div>
        </div>
      )}

      {step === "view" && (
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{t.view3dTitle}</h3>
          {unsupported ? (
            <p role="alert" style={{ ...card, fontSize: 14 }}>{t.unsupported}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, alignItems: "start" }}>
              <div>
                <Render3DViewer ref={viewer} model={model} poses={effective} photo={viewerPhoto} onSashTap={tap} onUnsupported={() => setUnsupported(true)} ariaLabel={t.view3dTitle} />
                <p style={{ margin: "6px 2px 0", fontSize: 12.5, color: "var(--color-text-secondary, #6b7280)" }}>{viewerPhoto ? t.viewHint : t.viewNoPhoto}</p>
                {mismatch ? <p role="status" data-testid="r3d-mismatch" style={{ margin: "6px 2px 0", fontSize: 12.5, color: "#92400e" }}>{t.mismatch}</p> : null}
                {!photo ? <div style={{ marginTop: 8 }}>{photoButtons}</div> : null}
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn accent={accent} onClick={() => setAll("open")} testId="r3d-open-all">{t.openAll}</Btn>
                  <Btn accent={accent} onClick={() => setAll("closed")} testId="r3d-close-all">{t.closeAll}</Btn>
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t.colour}</legend>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 190, overflowY: "auto", padding: 2 }}>
                    {colors.map((c) => (
                      <button key={c.key} type="button" aria-label={c.label} title={c.label} aria-pressed={colorKey === c.key} data-testid={`r3d-colour-${c.key}`} onClick={() => onColor(c.key)} style={{ width: 44, height: 44, borderRadius: 10, padding: 0, cursor: "pointer", background: c.hex, backgroundImage: c.textureUrl ? `url(${c.textureUrl})` : undefined, backgroundSize: "cover", border: colorKey === c.key ? `3px solid ${accent}` : "1.5px solid var(--color-border, #d1d5db)", outline: colorKey === c.key ? "2px solid #fff" : undefined, outlineOffset: -5 }} />
                    ))}
                  </div>
                </fieldset>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t.hardware}</legend>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {hardware.map((c) => (
                      <button key={c.key} type="button" aria-label={c.label} title={c.label} aria-pressed={hardwareKey === c.key} data-testid={`r3d-hw-${c.key}`} onClick={() => onHardware(c.key)} style={{ width: 44, height: 44, borderRadius: 999, padding: 0, cursor: "pointer", background: c.hex, border: hardwareKey === c.key ? `3px solid ${accent}` : "1.5px solid var(--color-border, #d1d5db)" }} />
                    ))}
                  </div>
                </fieldset>
                {model.sashes.map((s, i) => (
                  <div key={i} style={{ ...card, padding: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{t.leaf} {i + 1}</div>
                    <label style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {t.leafType}
                      <select style={{ ...input, fontSize: 15 }} value={s.type} data-testid={`r3d-type-${i}`} onChange={(e) => onSashType(i, e.target.value as SashKind)}>
                        {(sashTypes.some((o) => o.key === s.type) ? sashTypes : [...sashTypes, { key: s.type, label: s.type }]).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </label>
                    {s.type !== "fix" && s.type !== "tilt" ? (
                      <div role="group" aria-label={t.leafSide} style={{ display: "flex", gap: 6 }}>
                        <Btn accent={accent} ariaPressed={openingSide(s.type, s.direction) === "left"} onClick={() => onSashDirection(i, "left")} testId={`r3d-dir-${i}-left`}>{t.left}</Btn>
                        <Btn accent={accent} ariaPressed={openingSide(s.type, s.direction) === "right"} onClick={() => onSashDirection(i, "right")} testId={`r3d-dir-${i}-right`}>{t.right}</Btn>
                      </div>
                    ) : null}
                    {posesFor(s.type).length > 1 ? (
                      <div role="group" aria-label={t.leafType} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {posesFor(s.type).map((p) => (
                          <Btn key={p} accent={accent} ariaPressed={effective[i] === p} onClick={() => setPose(i, p)} testId={`r3d-pose-${i}-${p}`}>{t.pose[p]}</Btn>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn accent={accent} onClick={() => void save(false)} testId="r3d-save">{t.saveImage}</Btn>
                  {canShare ? <Btn accent={accent} onClick={() => void save(true)}>{t.shareImage}</Btn> : null}
                  {onClose ? <Btn primary accent={accent} onClick={onClose} testId="r3d-close">{t.backToConfig}</Btn> : null}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary, #6b7280)" }}>{t.indicative}</p>
              </div>
            </div>
          )}
          <div>
            <Btn accent={accent} onClick={() => setStep("photo")}>← {t.back}</Btn>
          </div>
        </div>
      )}
    </section>
  );
}
