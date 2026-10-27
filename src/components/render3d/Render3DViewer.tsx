"use client";

/**
 * The 3D view. With a photo: the window is drawn on top of it with the perspective of the shot (the camera is recovered from the four
 * corners the customer marked). Without a photo: a kitchen with a landscape outside, that you can turn around (inside or outside view).
 * Loaded on demand (three.js is heavy): import it through `Render3DStudio`, never at the top of a page.
 *
 * Built to be light on every device: it draws only when something changes or moves, caps the pixel ratio by quality, steps the quality
 * down by itself when frames are slow, keeps one static shadow map, and recovers from a lost WebGL context.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FrameGovernor, RES_STEPS, anisotropyFor, detectCaps, initialQuality, nextLower, pixelRatioFor, wantsMultisample, type Quality } from "@/lib/render3d/capabilities";
import { containFit, photoBoxHeight, poseFromQuad, type CameraPose, type PhotoSize, type Quad } from "@/lib/render3d/geometry";
import { buildRoom, ROOM_SURROUND, type RoomRig } from "@/lib/render3d/room-3d";
import type { RoomScene } from "@/lib/render3d/model";
import { buildWindow3D, type AccessoryName, type AccessoryState, type SashPose, type Window3DInput, type Window3DRig } from "@/lib/render3d/window-3d";

export interface ViewerPhoto extends PhotoSize {
  url: string;
  /** The four corners of the old window's outer frame in the photo, in the photo's own pixels. */
  quad: Quad;
  /** Focal length in photo pixels; null = a typical phone lens. */
  focalPx: number | null;
}

export type ViewSide = "inside" | "outside";

export interface Render3DViewerHandle {
  /** The picture as it is now (photo + window, or the room), or null when it cannot be made. */
  capture(): Promise<Blob | null>;
}

export type UnsupportedReason = "webgl" | "context";

interface Props {
  model: Window3DInput;
  poses: SashPose[];
  accessories: AccessoryState;
  photo?: ViewerPhoto | null;
  /** Room mode: look from inside the kitchen or from the garden. */
  view?: ViewSide;
  /** The room the window is seen in (room mode). */
  scene?: RoomScene;
  /** Changes every time the customer asks to go back to the starting view. */
  viewNonce?: number;
  onSashTap?: (index: number) => void;
  onAccessoryTap?: (name: AccessoryName) => void;
  onUnsupported?: (reason: UnsupportedReason) => void;
  onQuality?: (q: Quality) => void;
  ariaLabel: string;
  /** Fills its parent (the studio layer) instead of having its own height. */
  fill?: boolean;
}

const NEAR = 20;
const FAR = 260000;

function projectionFor(f: number, w: number, h: number): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.set((2 * f) / w, 0, 0, 0, 0, (2 * f) / h, 0, 0, 0, 0, -(FAR + NEAR) / (FAR - NEAR), (-2 * FAR * NEAR) / (FAR - NEAR), 0, 0, -1, 0);
  return m;
}

/** World -> three camera matrix from a photo pose (the photo convention has y down and z forward; three has y up and z backward). */
function viewFor(pose: CameraPose): THREE.Matrix4 {
  const r = pose.rotation;
  const t = pose.translation;
  const v = new THREE.Matrix4();
  v.set(r[0], r[1], r[2], t[0], -r[3], -r[4], -r[5], -t[1], -r[6], -r[7], -r[8], -t[2], 0, 0, 0, 1);
  return v;
}

/** Mean colour of the photo, to light the window the way the room is lit. */
function photoAmbient(img: HTMLImageElement): { color: THREE.Color; level: number } {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d");
    if (!g) throw new Error("no 2d");
    g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let r = 0;
    let gg = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      gg += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    const mean = new THREE.Color(r / n / 255, gg / n / 255, b / n / 255);
    const lum = 0.2126 * mean.r + 0.7152 * mean.g + 0.0722 * mean.b;
    return { color: new THREE.Color(1, 1, 1).lerp(mean.clone().multiplyScalar(1 / Math.max(0.2, lum)), 0.25), level: Math.min(1.25, Math.max(0.55, 0.45 + lum * 1.2)) };
  } catch {
    return { color: new THREE.Color(1, 1, 1), level: 0.9 };
  }
}

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls | null;
  rig: Window3DRig | null;
  room: RoomRig | null;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  envTexture: THREE.Texture;
  raf: number;
  last: number;
  quality: Quality;
  governor: FrameGovernor;
  shadowClock: number;
  anisotropy: number;
  /** Index in RES_STEPS: the resolution used while the picture moves (0 = full). At rest it goes back to 0. */
  res: number;
  /** The size of the drawing buffer in CSS pixels and the pixel ratio at full resolution. */
  cssW: number;
  cssH: number;
  baseRatio: number;
  restTimer: number;
  /** True while the shaders compile in the background (a frame drawn now would freeze the page): nothing is drawn until it is done. */
  compiling: boolean;
}

/** A named point on the performance timeline (devtools, and the tests that watch how long opening takes). */
const mark = (name: string) => {
  try {
    performance.mark(name);
  } catch {
    /* no timeline */
  }
};

/** Sets the drawing-buffer resolution (a real reallocation, so only when the step or the size really changes). */
function applyResolution(t: Ctx) {
  const ratio = t.baseRatio * RES_STEPS[t.res];
  if (t.cssW <= 0 || t.cssH <= 0) return;
  if (t.renderer.getPixelRatio() !== ratio) t.renderer.setPixelRatio(ratio);
  const size = t.renderer.getSize(new THREE.Vector2());
  if (size.x !== t.cssW || size.y !== t.cssH || t.renderer.domElement.width !== Math.floor(t.cssW * ratio)) t.renderer.setSize(t.cssW, t.cssH, false);
}

export const Render3DViewer = forwardRef<Render3DViewerHandle, Props>(function Render3DViewer(
  { model, poses, accessories, photo = null, view = "inside", scene = "kitchen", viewNonce = 0, onSashTap, onAccessoryTap, onUnsupported, onQuality, ariaLabel, fill = false },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<PhotoSize>({ width: 0, height: 0 });
  const [photoReady, setPhotoReady] = useState(false);
  const [epoch, setEpoch] = useState(0); // bumped when a lost WebGL context comes back: everything is recreated
  const [canvasKey, setCanvasKey] = useState(0); // a canvas whose context died cannot get a new one: it is replaced
  const forcedLow = useRef(false); // after a lost context (memory) the scene is rebuilt at the lightest level
  const three = useRef<Ctx | null>(null);
  const cb = useRef({ onSashTap, onAccessoryTap, onUnsupported, onQuality });
  cb.current = { onSashTap, onAccessoryTap, onUnsupported, onQuality };
  const latest = useRef({ poses, accessories, model, photo, view, scene });
  latest.current = { poses, accessories, model, photo, view, scene };

  const fit = useMemo(() => (photo && box.width > 0 ? containFit(photo, box) : null), [photo, box]);
  const cssW = photo ? (fit?.width ?? 0) : box.width;
  const cssH = photo ? (fit?.height ?? 0) : box.height;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setBox({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const schedule = useCallback(() => {
    const t = three.current;
    if (!t || t.raf) return;
    const tick = (now: number) => {
      const cur = three.current;
      if (!cur) return;
      cur.raf = 0;
      if (cur.compiling) return;
      const dtMs = now - cur.last;
      const dt = Math.min(0.05, dtMs / 1000 || 0.016);
      cur.last = now;
      const moving = cur.rig?.step(dt) ?? false;
      const damping = cur.controls?.update(dt) ?? false;
      const active = moving || damping;
      // The sun's shadows follow the moving parts: a few times a second on a strong device, only at rest otherwise (a shadow map is a
      // whole extra render of the scene).
      if (cur.renderer.shadowMap.enabled && moving && cur.quality === "high") {
        cur.shadowClock += dtMs;
        if (cur.shadowClock > 120) {
          cur.renderer.shadowMap.needsUpdate = true;
          cur.shadowClock = 0;
        }
      }
      cur.renderer.render(cur.scene, cur.camera);
      mark("r3d:frame");
      if (active) {
        window.clearTimeout(cur.restTimer);
        cur.restTimer = 0;
        // 60 frames a second is the aim: when the average is slower, the picture gets coarser WHILE it moves (nothing is rebuilt).
        if (cur.governor.sample(dtMs)) {
          cur.governor.reset();
          if (cur.res < RES_STEPS.length - 1) {
            cur.res++;
            applyResolution(cur);
          } else if (cur.renderer.shadowMap.enabled) {
            cur.renderer.shadowMap.enabled = false;
            cur.quality = "low";
            cb.current.onQuality?.("low");
          } else if (cur.quality !== "low") {
            cur.quality = nextLower(cur.quality);
            cb.current.onQuality?.(cur.quality);
          }
        }
        cur.raf = requestAnimationFrame(tick);
      } else {
        cur.governor.reset();
        // At rest: back to the sharp resolution and one last shadow refresh, so the still picture is the best one.
        const sharpen = () => {
          const c2 = three.current;
          if (!c2) return;
          c2.restTimer = 0;
          if (c2.res !== 0) {
            c2.res = 0;
            applyResolution(c2);
          }
          if (c2.renderer.shadowMap.enabled) c2.renderer.shadowMap.needsUpdate = true;
          c2.renderer.render(c2.scene, c2.camera);
        };
        if (cur.res !== 0 || cur.renderer.shadowMap.enabled) {
          window.clearTimeout(cur.restTimer);
          cur.restTimer = window.setTimeout(sharpen, 160);
        }
      }
    };
    t.last = performance.now();
    t.raf = requestAnimationFrame(tick);
  }, []);

  // Compiles the shaders of what is in the scene WITHOUT blocking the page (the browser does it on its own threads), then draws.
  const warm = useCallback(() => {
    const t = three.current;
    if (!t) return;
    // Without the browser's parallel compile (older or software GL) the compile would be synchronous anyway: draw straight away.
    if (!t.renderer.extensions.has("KHR_parallel_shader_compile")) {
      schedule();
      return;
    }
    t.compiling = true;
    const done = () => {
      const c = three.current;
      if (c === t) {
        mark("r3d:compiled");
        c.compiling = false;
        schedule();
      }
    };
    try {
      t.renderer.compileAsync(t.scene, t.camera).then(done, done);
    } catch {
      done();
    }
  }, [schedule]);

  // ── The renderer, created once per WebGL context ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const caps = detectCaps();
    if (!caps.webgl2) {
      cb.current.onUnsupported?.("webgl");
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: wantsMultisample(caps), alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    } catch {
      cb.current.onUnsupported?.("webgl");
      return;
    }
    mark("r3d:start");
    const quality: Quality = forcedLow.current ? "low" : initialQuality(caps);
    const baseRatio = pixelRatioFor(quality, window.devicePixelRatio);
    renderer.setPixelRatio(baseRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = quality !== "low";
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new THREE.Scene();
    mark("r3d:renderer");
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envTexture = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTexture;
    envScene.dispose();
    pmrem.dispose();
    mark("r3d:env");
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-1500, 2600, 3200);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(40, 1, NEAR, FAR);
    three.current = {
      renderer,
      scene,
      camera,
      controls: null,
      rig: null,
      room: null,
      hemi,
      key,
      envTexture,
      raf: 0,
      last: 0,
      quality,
      governor: new FrameGovernor(),
      shadowClock: 0,
      anisotropy: anisotropyFor(caps, renderer.capabilities.getMaxAnisotropy()),
      res: 0,
      cssW: 0,
      cssH: 0,
      baseRatio,
      restTimer: 0,
      compiling: false,
    };
    cb.current.onQuality?.(quality);

    // A lost context (the phone gave the GPU to another app) is not the end: the picture comes back when it is restored.
    let lostTimer = 0;
    const onLost = (e: Event) => {
      e.preventDefault();
      // If the browser does not give the context back by itself, start again on a fresh canvas at the lightest level (once);
      // only a second loss in a row is reported to the customer.
      lostTimer = window.setTimeout(() => {
        if (forcedLow.current) {
          cb.current.onUnsupported?.("context");
        } else {
          forcedLow.current = true;
          setCanvasKey((n) => n + 1);
          setEpoch((n) => n + 1);
        }
      }, 1200);
    };
    const onRestored = () => {
      window.clearTimeout(lostTimer);
      forcedLow.current = true;
      setEpoch((n) => n + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const onVisible = () => {
      if (!document.hidden) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(lostTimer);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisible);
      const t = three.current;
      if (t) {
        cancelAnimationFrame(t.raf);
        window.clearTimeout(t.restTimer);
        t.controls?.dispose();
        t.rig?.dispose();
        t.room?.dispose();
        t.envTexture.dispose();
        t.renderer.dispose();
        t.renderer.forceContextLoss();
      }
      three.current = null;
    };
  }, [epoch, canvasKey, schedule]);

  // ── The photo: wait for it, and light the window like the room ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setPhotoReady(false);
  }, [photo?.url]);
  const onPhotoLoad = useCallback(() => {
    const t = three.current;
    const img = imgRef.current;
    if (t && img) {
      const amb = photoAmbient(img);
      t.hemi.color.copy(amb.color);
      t.hemi.intensity = amb.level;
    }
    setPhotoReady(true);
  }, []);

  // ── The room (no photo): rebuilt only when what it depends on changes ─────────────────────────────────────────────────────────
  const boxH = model.accessories?.box?.heightMm ?? (model.accessories?.roller ? 250 : 0);
  const roomKey = photo ? "photo" : `${scene}:${model.widthMm}x${model.heightMm}:${model.door ? 1 : 0}:${boxH}`;
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (t.room) {
      t.scene.remove(t.room.group);
      t.room.dispose();
      t.room = null;
      t.scene.fog = null;
    }
    t.hemi.groundColor.set(0x8a8478);
    if (!photo) {
      mark("r3d:room-start");
      const room = buildRoom(latest.current.model, t.quality, t.anisotropy, latest.current.scene);
      mark("r3d:room-built");
      t.scene.add(room.group);
      t.room = room;
      t.scene.fog = new THREE.Fog(room.skyHex, 30000, 150000);
      // Inside a room the light is the sun through the window plus a soft fill; the directional light of the photo mode is switched off.
      t.hemi.intensity = 0.55;
      t.hemi.color.set(0xfff4e6);
      t.key.visible = false;
      t.scene.environmentIntensity = 0.32;
      t.renderer.shadowMap.needsUpdate = true;
    } else {
      t.key.visible = true;
      t.scene.environmentIntensity = 0.7;
    }
    warm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, epoch, schedule, warm]);

  // ── The window itself, rebuilt when its description changes ───────────────────────────────────────────────────────────────
  const modelKey = JSON.stringify(model);
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (t.rig) {
      t.scene.remove(t.rig.group);
      t.rig.dispose();
    }
    const m = latest.current.model;
    mark("r3d:window-start");
    const rig = buildWindow3D(latest.current.photo ? m : { ...m, surround: ROOM_SURROUND }, { textureLoader: new THREE.TextureLoader(), anisotropy: t.anisotropy, onAsync: schedule });
    latest.current.poses.forEach((p, i) => rig.setPose(i, p));
    rig.setAccessoryState(latest.current.accessories);
    rig.step(10); // a rebuilt window appears already in its pose
    rig.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.Material;
        mesh.castShadow = !mat.transparent;
        mesh.receiveShadow = true;
      }
    });
    t.scene.add(rig.group);
    t.rig = rig;
    mark("r3d:window-built");
    t.renderer.shadowMap.needsUpdate = true;
    warm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, !!photo, epoch, schedule, warm]);

  useEffect(() => {
    const t = three.current;
    if (!t?.rig) return;
    poses.forEach((p, i) => t.rig!.setPose(i, p));
    schedule();
  }, [poses, schedule]);
  useEffect(() => {
    const t = three.current;
    if (!t?.rig) return;
    t.rig.setAccessoryState(accessories);
    schedule();
  }, [accessories, schedule]);

  // ── Camera and size: photo mode follows the photo, room mode orbits ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = three.current;
    if (!t || cssW <= 0 || cssH <= 0) return;
    t.cssW = cssW;
    t.cssH = cssH;
    applyResolution(t);
    const cam = t.camera;
    if (photo) {
      t.controls?.dispose();
      t.controls = null;
      const scale = cssW / photo.width;
      const pose = poseFromQuad(photo.quad, model.widthMm, model.heightMm, photo, photo.focalPx);
      if (pose) {
        cam.matrixAutoUpdate = false;
        cam.matrixWorldAutoUpdate = false;
        const v = viewFor(pose);
        cam.matrixWorldInverse.copy(v);
        cam.matrixWorld.copy(v).invert();
        cam.projectionMatrix.copy(projectionFor(pose.focalPx * scale, cssW, cssH));
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      }
    } else {
      cam.matrixAutoUpdate = true;
      cam.matrixWorldAutoUpdate = true;
      cam.aspect = cssW / cssH;
      cam.fov = cssW / cssH < 0.8 ? 62 : 46;
      cam.near = NEAR;
      cam.far = FAR;
      cam.updateProjectionMatrix();
      if (!t.controls) {
        const c = new OrbitControls(cam, t.renderer.domElement);
        c.enableDamping = true;
        c.dampingFactor = 0.08;
        c.enablePan = false;
        c.rotateSpeed = 0.7;
        c.zoomSpeed = 0.8;
        c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
        c.addEventListener("change", schedule);
        t.controls = c;
      }
    }
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, cssW, cssH, modelKey, epoch, schedule]);

  // The starting camera of the room: inside (eye height, looking at the window) or outside (in the garden, looking at the facade).
  useEffect(() => {
    const t = three.current;
    const room = t?.room;
    if (!t || !room || !t.controls || photo) return;
    const { cx, floorY, wallFaceZ, outerFaceZ } = room.bounds;
    const H = latest.current.model.heightMm;
    const c = t.controls;
    c.minPolarAngle = 0.5;
    c.maxPolarAngle = 1.72;
    if (view === "inside") {
      t.camera.position.set(cx + 450, floorY + 1500, wallFaceZ + Math.min(4300, room.bounds.backZ - wallFaceZ - 600));
      c.target.set(cx, Math.min(floorY + 1500, Math.max(floorY + 800, H / 2)), 0);
      c.minDistance = 700;
      c.maxDistance = 5000;
    } else {
      t.camera.position.set(cx + 1500, floorY + 1250, outerFaceZ - 4600);
      c.target.set(cx, H / 2, outerFaceZ);
      c.minDistance = 1200;
      c.maxDistance = 14000;
    }
    c.update();
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewNonce, roomKey, epoch, cssW > 0, schedule]);

  // Keep the camera on its own side of the wall: a swing of about 75° either way, never through the wall or behind the room.
  useEffect(() => {
    const t = three.current;
    if (!t?.controls || !t.room) return;
    const c = t.controls;
    const room = t.room;
    const onChange = () => {
      const side = latest.current.view === "inside" ? 1 : -1;
      const dx = t.camera.position.x - c.target.x;
      const dz = (t.camera.position.z - c.target.z) * side;
      const limit = Math.tan((75 * Math.PI) / 180);
      if (dz < 200) {
        t.camera.position.z = c.target.z + 200 * side;
      } else if (Math.abs(dx) > dz * limit) {
        t.camera.position.x = c.target.x + Math.sign(dx) * dz * limit;
      }
      // The inside view stays inside the room.
      if (latest.current.view === "inside") {
        t.camera.position.x = Math.min(room.bounds.maxX - 150, Math.max(room.bounds.minX + 150, t.camera.position.x));
        t.camera.position.z = Math.min(room.bounds.backZ - 150, t.camera.position.z);
        t.camera.position.y = Math.min(room.bounds.ceilingY - 120, Math.max(room.bounds.floorY + 250, t.camera.position.y));
      }
    };
    c.addEventListener("change", onChange);
    return () => c.removeEventListener("change", onChange);
  }, [roomKey, epoch, photo]);

  // ── A tap on a leaf or on an accessory asks the parent to move it (a drag turns the view and is not a tap) ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let down: { x: number; y: number; id: number } | null = null;
    let pointers = 0;
    const onDown = (e: PointerEvent) => {
      pointers++;
      down = pointers === 1 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    };
    const onUp = (e: PointerEvent) => {
      pointers = Math.max(0, pointers - 1);
      const t = three.current;
      const d = down;
      down = null;
      if (!t?.rig || !d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, t.camera);
      const hit = ray.intersectObjects([...t.rig.accessoryHits, ...t.rig.hitTargets], false)[0];
      if (!hit) return;
      const acc = hit.object.userData.accessory as AccessoryName | undefined;
      if (acc) cb.current.onAccessoryTap?.(acc);
      else if (typeof hit.object.userData.sashIndex === "number") cb.current.onSashTap?.(hit.object.userData.sashIndex);
    };
    const onCancel = () => {
      pointers = 0;
      down = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    };
  }, [canvasKey]);

  useImperativeHandle(
    ref,
    () => ({
      async capture() {
        const t = three.current;
        const canvas = canvasRef.current;
        if (!t || !canvas) return null;
        t.renderer.render(t.scene, t.camera);
        const out = document.createElement("canvas");
        const img = imgRef.current;
        if (photo && img) {
          const k = Math.min(1, 2048 / Math.max(photo.width, photo.height));
          out.width = Math.round(photo.width * k);
          out.height = Math.round(photo.height * k);
          const g = out.getContext("2d");
          if (!g) return null;
          g.drawImage(img, 0, 0, out.width, out.height);
          g.drawImage(canvas, 0, 0, out.width, out.height);
        } else {
          out.width = canvas.width;
          out.height = canvas.height;
          const g = out.getContext("2d");
          if (!g) return null;
          g.fillStyle = "#cfe3f1";
          g.fillRect(0, 0, out.width, out.height);
          g.drawImage(canvas, 0, 0);
        }
        return new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), "image/jpeg", 0.92));
      },
    }),
    [photo],
  );

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative",
        width: "100%",
        height: fill ? "100%" : photo ? photoBoxHeight(photo, box.width) : 420,
        background: photo ? "#111" : "#cfe3f1",
        overflow: "hidden",
        borderRadius: fill ? 0 : 12,
        touchAction: "none",
      }}
    >
      {photo && fit ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={photo.url}
          alt=""
          onLoad={onPhotoLoad}
          draggable={false}
          style={{ position: "absolute", left: fit.offsetX, top: fit.offsetY, width: fit.width, height: fit.height, userSelect: "none", pointerEvents: "none" }}
        />
      ) : null}
      <canvas
        key={canvasKey}
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        data-testid="render3d-canvas"
        data-ready={photo ? String(photoReady) : "true"}
        style={{ position: "absolute", left: photo && fit ? fit.offsetX : 0, top: photo && fit ? fit.offsetY : 0, width: cssW || "100%", height: cssH || "100%", opacity: photo && !photoReady ? 0 : 1, touchAction: "none", outline: "none" }}
      />
    </div>
  );
});
