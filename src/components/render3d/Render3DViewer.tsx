"use client";

/**
 * The 3D view. With a photo: the window is drawn on top of it with the perspective of the shot (the camera is recovered from
 * the four corners the customer marked). Without a photo: a room wall you can turn around.
 * Loaded on demand (three.js is heavy): import it through `Render3DStudio`, never at the top of a page.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { containFit, photoBoxHeight, poseFromQuad, type CameraPose, type PhotoSize, type Quad } from "@/lib/render3d/geometry";
import { buildWindow3D, FRAME_DEPTH_MM, type SashPose, type Window3DInput, type Window3DRig } from "@/lib/render3d/window-3d";

export interface ViewerPhoto extends PhotoSize {
  url: string;
  /** The four corners of the old window's outer frame in the photo, in the photo's own pixels. */
  quad: Quad;
  /** Focal length in photo pixels; null = a typical phone lens. */
  focalPx: number | null;
}

export interface Render3DViewerHandle {
  /** The picture as it is now (photo + window), or the plain 3D view; null when it cannot be made. */
  capture(): Promise<Blob | null>;
}

interface Props {
  model: Window3DInput;
  poses: SashPose[];
  photo?: ViewerPhoto | null;
  onSashTap?: (index: number) => void;
  onUnsupported?: () => void;
  ariaLabel: string;
  /** Height of the box when there is no photo (with a photo the box follows the photo). */
  minHeight?: number;
}

const NEAR = 20;
const FAR = 120000;

function projectionFor(poseF: number, w: number, h: number): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.set((2 * poseF) / w, 0, 0, 0, 0, (2 * poseF) / h, 0, 0, 0, 0, -(FAR + NEAR) / (FAR - NEAR), (-2 * FAR * NEAR) / (FAR - NEAR), 0, 0, -1, 0);
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
    // Tint the light a little towards the room, keep it mostly white.
    return { color: new THREE.Color(1, 1, 1).lerp(mean.clone().multiplyScalar(1 / Math.max(0.2, lum)), 0.25), level: Math.min(1.25, Math.max(0.55, 0.45 + lum * 1.2)) };
  } catch {
    return { color: new THREE.Color(1, 1, 1), level: 0.9 };
  }
}

function wallFor(model: Window3DInput): THREE.Group {
  const g = new THREE.Group();
  const W = model.widthMm;
  const H = model.heightMm;
  const pad = 1400;
  const shape = new THREE.Shape();
  shape.moveTo(-pad, -pad);
  shape.lineTo(W + pad, -pad);
  shape.lineTo(W + pad, H + pad);
  shape.lineTo(-pad, H + pad);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 0);
  hole.lineTo(0, H);
  hole.lineTo(W, H);
  hole.lineTo(W, 0);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 250, bevelEnabled: false });
  geo.translate(0, 0, -250);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#e9e4dc", roughness: 0.95 })));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(W + 6000, H + 6000), new THREE.MeshBasicMaterial({ color: "#cfe3f1" }));
  sky.position.set(W / 2, H / 2, -1800);
  g.add(sky);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 2800, 4000), new THREE.MeshStandardMaterial({ color: "#c9c3b8", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, -pad, 1500);
  g.add(floor);
  return g;
}

export const Render3DViewer = forwardRef<Render3DViewerHandle, Props>(function Render3DViewer(
  { model, poses, photo = null, onSashTap, onUnsupported, ariaLabel, minHeight = 420 },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<PhotoSize>({ width: 0, height: 0 });
  const [photoReady, setPhotoReady] = useState(false);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls | null;
    rig: Window3DRig | null;
    wall: THREE.Group | null;
    hemi: THREE.HemisphereLight;
    raf: number;
    last: number;
  } | null>(null);
  const tapRef = useRef(onSashTap);
  tapRef.current = onSashTap;
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;

  const fit = useMemo(() => (photo && box.width > 0 ? containFit(photo, box) : null), [photo, box]);
  const cssW = photo ? (fit?.width ?? 0) : box.width;
  const cssH = photo ? (fit?.height ?? 0) : box.height;

  // Size of the box we live in.
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
      const dt = Math.min(0.05, (now - cur.last) / 1000 || 0.016);
      cur.last = now;
      const moving = cur.rig?.step(dt) ?? false;
      const damping = cur.controls?.update(dt) ?? false;
      cur.renderer.render(cur.scene, cur.camera);
      if (moving || damping) cur.raf = requestAnimationFrame(tick);
    };
    t.last = performance.now();
    t.raf = requestAnimationFrame(tick);
  }, []);

  // The renderer, created once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    } catch {
      unsupportedRef.current?.();
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.7;
    envScene.dispose();
    pmrem.dispose();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(-1500, 2600, 3200);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(40, 1, NEAR, FAR);
    three.current = { renderer, scene, camera, controls: null, rig: null, wall: null, hemi, raf: 0, last: 0 };
    return () => {
      const t = three.current;
      if (t) {
        cancelAnimationFrame(t.raf);
        t.controls?.dispose();
        t.rig?.dispose();
        t.scene.environment?.dispose();
        t.renderer.dispose();
      }
      three.current = null;
    };
  }, []);

  // The photo: wait for it, and light the window like the room.
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

  // The window itself, rebuilt when its description changes.
  const modelKey = JSON.stringify(model);
  const posesRef = useRef(poses);
  posesRef.current = poses;
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (t.rig) {
      t.scene.remove(t.rig.group);
      t.rig.dispose();
    }
    const rig = buildWindow3D(model, new THREE.TextureLoader());
    posesRef.current.forEach((p, i) => rig.setPose(i, p));
    rig.step(10); // a rebuilt window appears already in its pose
    t.scene.add(rig.group);
    t.rig = rig;
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, schedule]);

  // Poses: animate to the asked ones.
  useEffect(() => {
    const t = three.current;
    if (!t?.rig) return;
    poses.forEach((p, i) => t.rig!.setPose(i, p));
    schedule();
  }, [poses, schedule]);

  // Camera, wall and size: photo mode follows the photo, free mode orbits.
  useEffect(() => {
    const t = three.current;
    if (!t || cssW <= 0 || cssH <= 0) return;
    t.renderer.setSize(cssW, cssH, false);
    const cam = t.camera;
    if (photo) {
      t.controls?.dispose();
      t.controls = null;
      if (t.wall) {
        t.scene.remove(t.wall);
        t.wall = null;
      }
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
      cam.fov = 38;
      cam.near = NEAR;
      cam.far = FAR;
      cam.updateProjectionMatrix();
      if (!t.wall) {
        t.wall = wallFor(model);
        t.scene.add(t.wall);
        cam.position.set(model.widthMm * 0.5 + 500, model.heightMm * 0.55, Math.max(model.widthMm, model.heightMm) * 2.3 + 900);
      }
      if (!t.controls) {
        const c = new OrbitControls(cam, t.renderer.domElement);
        c.enableDamping = true;
        c.enablePan = false;
        c.minDistance = 900;
        c.maxDistance = 9000;
        c.minPolarAngle = 0.55;
        c.maxPolarAngle = 1.75;
        c.minAzimuthAngle = -1.25;
        c.maxAzimuthAngle = 1.25;
        c.addEventListener("change", schedule);
        t.controls = c;
      }
      t.controls.target.set(model.widthMm / 2, model.heightMm / 2, -FRAME_DEPTH_MM / 2);
      t.controls.update();
    }
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, cssW, cssH, modelKey, schedule]);

  // A tap on a leaf asks the parent to open or close it (a drag turns the view and is not a tap).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const t = three.current;
      if (!t?.rig || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      down = null;
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, t.camera);
      const hit = ray.intersectObjects(t.rig.hitTargets, false)[0];
      const idx = hit?.object.userData.sashIndex;
      if (typeof idx === "number") tapRef.current?.(idx);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, []);

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
          // The renderer clears its buffer after presenting; a fresh render just above keeps this frame readable in the same task.
          g.drawImage(canvas, 0, 0, out.width, out.height);
        } else {
          out.width = canvas.width;
          out.height = canvas.height;
          const g = out.getContext("2d");
          if (!g) return null;
          g.fillStyle = "#e9e4dc";
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
      style={{ position: "relative", width: "100%", height: photo ? photoBoxHeight(photo, box.width) : minHeight, background: photo ? "#111" : "#dfe8ee", borderRadius: 12, overflow: "hidden", touchAction: photo ? "manipulation" : "none" }}
    >
      {photo && fit ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={photo.url}
          alt=""
          onLoad={onPhotoLoad}
          draggable={false}
          style={{ position: "absolute", left: fit.offsetX, top: fit.offsetY, width: fit.width, height: fit.height, userSelect: "none" }}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        data-testid="render3d-canvas"
        data-ready={photo ? String(photoReady) : "true"}
        style={{ position: "absolute", left: photo && fit ? fit.offsetX : 0, top: photo && fit ? fit.offsetY : 0, width: cssW || "100%", height: cssH || "100%", opacity: photo && !photoReady ? 0 : 1 }}
      />
    </div>
  );
});
