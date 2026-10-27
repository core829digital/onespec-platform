"use client";

/**
 * The 3D render of the new window, full screen: the room (or the customer's photo) fills the screen and a floating menu on top lets
 * the customer change everything (colour, hardware, glass, profile, leaf layout, openings, accessories) while the window moves and
 * changes in front of them. One component for every configurator: the owner passes the window (as the 3D model), the menu fields and the
 * callbacks that change the configuration, so the price and everything else stay in the owner's hands.
 */
import { Armchair, Blinds, Camera, Columns3, Download, DoorOpen, Layers, Maximize2, Minimize2, Palette, RotateCcw, Share2, Square, Wrench, ArrowLeft, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectCaps, type Caps, type Quality } from "@/lib/render3d/capabilities";
import { canNativeFullscreen, enterNativeFullscreen, exitNativeFullscreen, nativeFullscreenElement, onNativeFullscreenChange } from "@/lib/render3d/fullscreen";
import { estimateRectangle, isValidQuad, type PhotoSize, type Quad } from "@/lib/render3d/geometry";
import { releasePhoto, type LoadedPhoto } from "@/lib/render3d/photo";
import { render3dText } from "@/lib/render3d/render3d-text";
import { GROUP_IDS, render3dUi, type GroupId } from "@/lib/render3d/render3d-ui-text";
import { ROOM_SCENES, defaultSceneFor, type RoomScene } from "@/lib/render3d/model";
import { DEFAULT_ACCESSORY_STATE, posesFor, type AccessoryName, type AccessoryState, type SashPose, type Window3DInput } from "@/lib/render3d/window-3d";
import { PhotoFlow } from "./PhotoFlow";
import { Fields, type FieldDef, type GroupDef } from "./studio-fields";
import { STUDIO_CSS } from "./studio-ui";
import { NavPad } from "./NavPad";
import { Render3DViewer, type NavInput, type Render3DViewerHandle, type ViewSide, type ViewerPhoto } from "./Render3DViewer";

export type { FieldDef, GroupDef, StudioSwatch, StudioOption } from "./studio-fields";

export interface Render3DStudioProps {
  lang: string;
  model: Window3DInput;
  /** The menu: one group per tab, drawn from these fields. A group with no fields has no tab. */
  groups: GroupDef[];
  limits: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
  onSize: (widthMm: number, heightMm: number) => void;
  /** Back to the normal view (the configuration form, or the page before). */
  onBack: () => void;
  /** Called with true when the full-screen layer appears and false when it goes (a widget in a frame asks its host page for the whole screen). */
  onLayer?: (on: boolean) => void;
  accent?: string;
}

const ICONS: Record<GroupId, LucideIcon> = {
  color: Palette,
  hardware: Wrench,
  glass: Square,
  profile: Layers,
  leaves: Columns3,
  openings: DoorOpen,
  accessories: Blinds,
  scene: Armchair,
  photo: Camera,
};

function useWide(): boolean {
  const [wide, setWide] = useState(() => (typeof window === "undefined" ? true : window.matchMedia("(min-width: 760px) and (min-height: 480px)").matches));
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 760px) and (min-height: 480px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function Render3DStudio(props: Render3DStudioProps) {
  const { lang, model, groups, limits, onSize, onBack, onLayer, accent = "#16d19d" } = props;
  const t = render3dText(lang);
  const ui = render3dUi(lang);
  const wide = useWide();
  const layer = useRef<HTMLDivElement>(null);
  const viewer = useRef<Render3DViewerHandle>(null);
  const navigate = useCallback((v: NavInput) => viewer.current?.navigate(v), []);
  const [caps] = useState<Caps | null>(() => (typeof window === "undefined" ? null : detectCaps()));
  const [unsupported, setUnsupported] = useState<null | "webgl" | "context">(caps && !caps.webgl2 ? "webgl" : null);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState<GroupId | null>(() => (typeof window !== "undefined" && window.matchMedia("(min-width: 760px) and (min-height: 480px)").matches ? "color" : null));
  const [flow, setFlow] = useState(false);
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [poses, setPoses] = useState<SashPose[]>([]);
  const [acc, setAcc] = useState<AccessoryState>(DEFAULT_ACCESSORY_STATE);
  const [view, setView] = useState<ViewSide>("inside");
  // The room starts as the one that suits the window (a balcony door in the living room, a small window in the bathroom); the customer can change it.
  const [pickedScene, setPickedScene] = useState<RoomScene | null>(null);
  const scene = pickedScene ?? defaultSceneFor(model);
  const [viewNonce, setViewNonce] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [fsOk, setFsOk] = useState(false);
  const [hint, setHint] = useState(true);
  const [light, setLight] = useState(false);
  const startQuality = useRef<Quality | null>(null);

  // ── The layer: tells the host it is up, locks the page behind it, tries the native full screen, keeps focus inside ───────────────
  useEffect(() => {
    onLayer?.(true);
    setFsOk(canNativeFullscreen(layer.current));
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    // The browser only allows full screen right after a tap; if that moment has passed this quietly fails and the button stays available.
    if (layer.current && canNativeFullscreen(layer.current)) void enterNativeFullscreen(layer.current);
    const off = onNativeFullscreenChange(() => setIsFs(nativeFullscreenElement() === layer.current));
    const timer = window.setTimeout(() => setHint(false), 7000);
    return () => {
      window.clearTimeout(timer);
      off();
      html.style.overflow = prev;
      void exitNativeFullscreen();
      onLayer?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photoRef = useRef<LoadedPhoto | null>(null);
  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);
  useEffect(() => () => releasePhoto(photoRef.current), []);

  // The parent hands a new onBack on every render: keeping the latest in a ref keeps `back` (and the key listener below) stable.
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);
  const back = useCallback(() => {
    void exitNativeFullscreen();
    onBackRef.current();
  }, []);

  // Focus starts on "back" once, when the layer opens (never again while it is used: that would pull it out of a field being typed in).
  useEffect(() => {
    layer.current?.querySelector<HTMLElement>("[data-r3d-initial-focus]")?.focus({ preventScroll: true });
  }, []);

  // Escape closes the open panel, then leaves; Tab stays inside the layer.
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !nativeFullscreenElement()) {
        e.preventDefault();
        if (flow) setFlow(false);
        else if (open) setOpen(null);
        else back();
      }
      if (e.key === "Tab") {
        const f = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((n) => n.offsetParent !== null);
        if (f.length === 0) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [back, flow, open]);

  // ── The photo: its pose (focal length trusted only inside what a phone camera can have) ─────────────────────────────────────────
  const photoSize = useMemo<PhotoSize | null>(() => (photo ? { width: photo.width, height: photo.height } : null), [photo]);
  const quadOk = !!quad && isValidQuad(quad);
  const estimate = useMemo(() => (quadOk && photoSize ? estimateRectangle(quad!, photoSize) : null), [quadOk, quad, photoSize]);
  const focalPx = useMemo(() => {
    if (!estimate?.focalPx || !photoSize) return null;
    const side = Math.max(photoSize.width, photoSize.height);
    return estimate.focalPx >= 0.45 * side && estimate.focalPx <= 2.2 * side ? estimate.focalPx : null;
  }, [estimate, photoSize]);
  const viewerPhoto: ViewerPhoto | null = photo && quadOk ? { url: photo.url, width: photo.width, height: photo.height, quad: quad!, focalPx } : null;

  // ── Poses and accessories ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const effective = useMemo(() => model.sashes.map((s, i) => (posesFor(s.type).includes(poses[i]) ? poses[i] : "closed")), [model.sashes, poses]);
  const setPose = useCallback((i: number, p: SashPose) => setPoses((old) => model.sashes.map((_, k) => (k === i ? p : (old[k] ?? "closed")))), [model.sashes]);
  const tapSash = useCallback(
    (i: number) => {
      const s = model.sashes[i];
      if (!s) return;
      const order = posesFor(s.type);
      if (order.length < 2) return;
      setPose(i, order[(order.indexOf(effective[i]) + 1) % order.length]);
    },
    [effective, model.sashes, setPose],
  );
  const setAll = (mode: "open" | "closed") => setPoses(model.sashes.map((s) => (mode === "closed" ? "closed" : posesFor(s.type).includes("open") ? "open" : posesFor(s.type).includes("tilt") ? "tilt" : "closed")));
  const toggleAcc = useCallback((name: AccessoryName) => setAcc((a) => ({ ...a, [name]: a[name] > 0.5 ? 0 : 1 })), []);

  const hasScreen = !!model.accessories?.screen;
  const hasRoller = !!model.accessories?.roller;
  const hasShutter = !!model.accessories?.shutter;
  const screenMovable = hasScreen && model.accessories?.screen?.kind !== "fixed";

  // ── Top bar actions ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  const save = async (share: boolean) => {
    const blob = await viewer.current?.capture();
    if (!blob) return;
    const file = new File([blob], "render-3d.jpg", { type: "image/jpeg" });
    if (share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t.title });
      } catch {
        /* the customer closed the share sheet */
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "render-3d.jpg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const toggleFs = () => {
    if (!layer.current) return;
    if (nativeFullscreenElement()) void exitNativeFullscreen();
    else void enterNativeFullscreen(layer.current);
  };

  // ── The menu ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g.fields] as const)), [groups]);
  const tabs = GROUP_IDS.filter((id) => (id === "scene" ? !viewerPhoto : false) || id === "photo" || id === "openings" || (byId.get(id)?.length ?? 0) > 0 || (id === "accessories" && (hasScreen || hasRoller || hasShutter)));
  const fields = (id: GroupId): FieldDef[] => byId.get(id) ?? [];

  const liveCard = (title: string, children: React.ReactNode, testId: string) => (
    <div className="r3d-card" data-testid={testId}>
      <p className="r3d-label" style={{ margin: 0 }}>{title}</p>
      <div className="r3d-chips">{children}</div>
    </div>
  );
  const chip = (label: string, pressed: boolean, onClick: () => void, testId: string) => (
    <button type="button" className="r3d-chip" aria-pressed={pressed} data-testid={testId} onClick={onClick}>
      {label}
    </button>
  );

  const panelBody = (id: GroupId) => {
    if (id === "photo") {
      return (
        <>
          <p className="r3d-note">{photo ? ui.photoActive : ui.photoModeTitle}</p>
          <div className="r3d-chips">
            <button type="button" className="r3d-chip" data-testid="r3d-open-photoflow" onClick={() => setFlow(true)}>
              <Camera size={16} aria-hidden="true" /> {photo ? t.changePhoto : t.takePhoto}
            </button>
            <button type="button" className="r3d-chip" data-testid="r3d-open-measure" onClick={() => setFlow(true)}>
              {t.stepMeasure}: {model.widthMm} × {model.heightMm} {t.mm}
            </button>
            {photo ? (
              <button
                type="button"
                className="r3d-chip"
                data-testid="r3d-photo-off"
                onClick={() => {
                  releasePhoto(photo);
                  setPhoto(null);
                  setQuad(null);
                }}
              >
                {ui.photoRemove}
              </button>
            ) : null}
          </div>
          <p className="r3d-note">{t.photoPrivacy}</p>
        </>
      );
    }
    if (id === "scene") {
      return (
        <>
          <div className="r3d-chips" role="group" aria-label={ui.groups.scene}>
            {ROOM_SCENES.map((k) => chip(ui.scenes[k], scene === k, () => { setPickedScene(k); setViewNonce((n) => n + 1); }, `r3d-scene-${k}`))}
          </div>
          <p className="r3d-note">{ui.sceneNote}</p>
        </>
      );
    }
    if (id === "openings") {
      return (
        <>
          <div className="r3d-chips">
            {chip(t.openAll, false, () => setAll("open"), "r3d-open-all")}
            {chip(t.closeAll, false, () => setAll("closed"), "r3d-close-all")}
          </div>
          <Fields fields={fields("openings")} />
          {model.sashes.map((s, i) => {
            const list = posesFor(s.type);
            if (list.length < 2) return null;
            return liveCard(
              `${t.leaf} ${i + 1}`,
              list.map((p) => chip(t.pose[p], effective[i] === p, () => setPose(i, p), `r3d-pose-${i}-${p}`)),
              `r3d-live-leaf-${i}`,
            );
          })}
          <p className="r3d-note">{ui.tapHint}</p>
        </>
      );
    }
    if (id === "accessories") {
      const any = hasScreen || hasRoller || hasShutter || fields("accessories").length > 0;
      return (
        <>
          <Fields fields={fields("accessories")} />
          {hasScreen && screenMovable
            ? liveCard(ui.netTitle, [chip(ui.netClose, acc.screen > 0.5, () => setAcc((a) => ({ ...a, screen: 1 })), "r3d-net-close"), chip(ui.netOpen, acc.screen <= 0.5, () => setAcc((a) => ({ ...a, screen: 0 })), "r3d-net-open")], "r3d-live-screen")
            : null}
          {hasRoller
            ? liveCard(
                ui.rollerTitle,
                [
                  chip(ui.rollerDown, acc.roller > 0.5, () => setAcc((a) => ({ ...a, roller: 1 })), "r3d-roller-down"),
                  chip(ui.rollerUp, acc.roller <= 0.5, () => setAcc((a) => ({ ...a, roller: 0 })), "r3d-roller-up"),
                ],
                "r3d-live-roller",
              )
            : null}
          {hasShutter
            ? liveCard(ui.shutterTitle, [chip(ui.shutterClose, acc.shutter > 0.5, () => setAcc((a) => ({ ...a, shutter: 1 })), "r3d-shutter-close"), chip(ui.shutterOpen, acc.shutter <= 0.5, () => setAcc((a) => ({ ...a, shutter: 0 })), "r3d-shutter-open")], "r3d-live-shutter")
            : null}
          {!any ? <p className="r3d-note">{ui.accessoriesNone}</p> : null}
          <div className="r3d-card">
            <p className="r3d-label" style={{ margin: 0 }}>{ui.orderTitle}</p>
            <p className="r3d-note">{ui.orderBody}</p>
            {hasRoller && hasShutter ? <p className="r3d-note">{ui.orderNote}</p> : null}
          </div>
        </>
      );
    }
    return (
      <>
        <Fields fields={fields(id)} />
        {id === "glass" ? <p className="r3d-note">{ui.f.glassNote}</p> : null}
      </>
    );
  };

  const roomMode = !viewerPhoto;
  const dockClass = `r3d-dock r3d-glass ${wide ? "v" : "h"}`;

  return (
    <div
      ref={layer}
      className="r3d-layer"
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      data-testid="render3d-studio"
      style={{ ["--r3d-accent" as string]: accent } as React.CSSProperties}
    >
      <style>{STUDIO_CSS}</style>
      <div className="r3d-view">
        {unsupported ? (
          <div className="r3d-fallback" role="alert" data-testid="r3d-unsupported">
            <div className="r3d-glass" style={{ maxWidth: 480, padding: 22, borderRadius: 20 }}>
              <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.5 }}>{unsupported === "webgl" ? ui.unsupportedWebgl : ui.unsupportedContext}</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" className="r3d-btn" data-testid="r3d-try-again" onClick={() => { setUnsupported(null); setRetry((n) => n + 1); }}>
                  {ui.tryAgain}
                </button>
                <button type="button" className="r3d-btn" onClick={back}>
                  {ui.back}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Render3DViewer
            key={retry}
            ref={viewer}
            fill
            model={model}
            poses={effective}
            accessories={acc}
            photo={viewerPhoto}
            view={view}
            scene={scene}
            viewNonce={viewNonce}
            onSashTap={tapSash}
            onAccessoryTap={toggleAcc}
            onUnsupported={setUnsupported}
            onQuality={(q) => {
              if (startQuality.current === null) startQuality.current = q;
              else if (q !== startQuality.current) {
                setLight(true);
                window.setTimeout(() => setLight(false), 6000);
              }
            }}
            ariaLabel={ui.menu}
          />
        )}
      </div>

      <div className="r3d-top">
        <button type="button" className="r3d-btn" onClick={back} data-testid="r3d-close" data-r3d-initial-focus aria-label={ui.back}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span style={{ display: wide ? "inline" : "none" }}>{ui.back}</span>
        </button>
        <div className="r3d-spacer" />
        {roomMode ? (
          <>
            <button type="button" className="r3d-btn" aria-pressed={view === "inside"} data-testid="r3d-view-inside" onClick={() => { setView("inside"); setViewNonce((n) => n + 1); }}>
              {ui.viewInside}
            </button>
            <button type="button" className="r3d-btn" aria-pressed={view === "outside"} data-testid="r3d-view-outside" onClick={() => { setView("outside"); setViewNonce((n) => n + 1); }}>
              {ui.viewOutside}
            </button>
            <button type="button" className="r3d-btn" aria-label={ui.resetView} title={ui.resetView} data-testid="r3d-reset-view" onClick={() => setViewNonce((n) => n + 1)}>
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          </>
        ) : null}
        {fsOk ? (
          <button type="button" className="r3d-btn" aria-label={isFs ? ui.exitFullscreen : ui.fullscreen} title={isFs ? ui.exitFullscreen : ui.fullscreen} data-testid="r3d-fullscreen" onClick={toggleFs}>
            {isFs ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          </button>
        ) : null}
        <button type="button" className="r3d-btn" aria-label={t.saveImage} title={t.saveImage} data-testid="r3d-save" onClick={() => void save(false)}>
          <Download size={18} aria-hidden="true" />
        </button>
        {canShare ? (
          <button type="button" className="r3d-btn" aria-label={t.shareImage} title={t.shareImage} onClick={() => void save(true)}>
            <Share2 size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {roomMode && !unsupported && !flow && (wide || !open) ? (
        <NavPad
          onNavigate={navigate}
          labels={{ pad: ui.navPad, rotate: ui.navRotate, slide: ui.navSlide, up: ui.navUp, down: ui.navDown, left: ui.navLeft, right: ui.navRight, zoomIn: ui.navIn, zoomOut: ui.navOut }}
        />
      ) : null}

      {light ? (
        <div className="r3d-hint r3d-glass" role="status" style={{ top: "calc(70px + env(safe-area-inset-top))", bottom: "auto" }}>
          {ui.lightMode}
        </div>
      ) : null}
      {hint && !open && !unsupported ? (
        <div className="r3d-hint r3d-glass" role="status">
          {ui.tapHint}
        </div>
      ) : null}

      {!unsupported ? (
        <nav className={dockClass} role="tablist" aria-label={ui.menu} aria-orientation={wide ? "vertical" : "horizontal"}>
          {tabs.map((id) => {
            const Icon = ICONS[id];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                className="r3d-tab"
                aria-selected={open === id}
                aria-controls="r3d-panel"
                data-testid={`r3d-tab-${id}`}
                onClick={() => {
                  setHint(false);
                  if (id === "photo" && !photo) {
                    setOpen(id);
                    return;
                  }
                  setOpen((cur) => (cur === id ? null : id));
                }}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{ui.groups[id]}</span>
              </button>
            );
          })}
        </nav>
      ) : null}

      {open && !unsupported ? (
        <section id="r3d-panel" className={`r3d-panel r3d-glass ${wide ? "v" : "h"}`} role="tabpanel" aria-label={ui.groups[open]} data-testid={`r3d-panel-${open}`} key={open}>
          <div className="r3d-panel-head">
            {(() => {
              const Icon = ICONS[open];
              return <Icon size={18} aria-hidden="true" />;
            })()}
            <span style={{ flex: 1 }}>{ui.groups[open]}</span>
            <button type="button" className="r3d-btn" style={{ minWidth: 40, minHeight: 40, padding: 0 }} aria-label={ui.closePanel} data-testid="r3d-panel-close" onClick={() => setOpen(null)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="r3d-panel-body">{panelBody(open)}</div>
        </section>
      ) : null}

      {flow ? (
        <div className="r3d-sheet-full" data-testid="r3d-flow-sheet">
          <PhotoFlow
            lang={lang}
            accent={accent === "#16d19d" ? "#0f9f77" : accent}
            size={{ widthMm: model.widthMm, heightMm: model.heightMm }}
            limits={limits}
            onSize={onSize}
            photo={photo}
            quad={quad}
            onPhoto={(p, q) => {
              setPhoto(p);
              setQuad(q);
            }}
            onQuad={setQuad}
            onDone={() => setFlow(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
