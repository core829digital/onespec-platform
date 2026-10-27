/** Textures drawn in code (no files to download): wood grain, the mosquito-net mesh, the slats of a roller shutter. Browser only. */
import * as THREE from "three";

const hasCanvas = () => typeof document !== "undefined" && typeof document.createElement === "function";

/** A small deterministic random generator, so the same finish always gets the same grain. */
function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  if (!hasCanvas()) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  return g ? { c, g } : null;
}

function finish(t: THREE.CanvasTexture, anisotropy: number): THREE.CanvasTexture {
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

/** Wood grain along the vertical axis of the canvas, in the given base colour. Null where there is no canvas (tests). */
export function woodGrainTexture(baseHex: string, anisotropy = 4): THREE.CanvasTexture | null {
  const cv = canvas(256, 512);
  if (!cv) return null;
  const { c, g } = cv;
  const base = new THREE.Color(baseHex);
  const dark = base.clone().multiplyScalar(0.7);
  const light = base.clone().lerp(new THREE.Color("#ffffff"), 0.12);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 256, 512);
  const rnd = prng(1234 + baseHex.charCodeAt(1) * 31 + baseHex.charCodeAt(3));
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 256;
    const w = 0.6 + rnd() * 2.6;
    g.strokeStyle = `#${(rnd() > 0.35 ? dark : light).getHexString()}`;
    g.globalAlpha = 0.1 + rnd() * 0.28;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, 0);
    const wobble = (rnd() - 0.5) * 16;
    g.bezierCurveTo(x + wobble, 170, x - wobble, 340, x + (rnd() - 0.5) * 10, 512);
    g.stroke();
  }
  // A few knots.
  for (let i = 0; i < 2; i++) {
    const x = 30 + rnd() * 196;
    const y = 40 + rnd() * 430;
    for (let r = 14; r > 2; r -= 3) {
      g.globalAlpha = 0.06;
      g.strokeStyle = `#${dark.getHexString()}`;
      g.beginPath();
      g.ellipse(x, y, r * 0.6, r * 1.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  return finish(new THREE.CanvasTexture(c), anisotropy);
}

/** The mesh of a mosquito net as an alpha pattern: fine dark threads, mostly see-through. */
export function netMeshTexture(anisotropy = 4): THREE.CanvasTexture | null {
  const cv = canvas(16, 16);
  if (!cv) return null;
  const { c, g } = cv;
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = "rgba(24,26,28,0.85)";
  g.fillRect(0, 0, 16, 1.4);
  g.fillRect(0, 0, 1.4, 16);
  const t = new THREE.CanvasTexture(c);
  t.premultiplyAlpha = false;
  return finish(t, anisotropy);
}

/** The slats of a roller shutter: one slat per `repeat`, with a lit top edge and a shaded lower lip. */
export function slatTexture(hex: string, anisotropy = 4): THREE.CanvasTexture | null {
  const cv = canvas(32, 64);
  if (!cv) return null;
  const { c, g } = cv;
  const base = new THREE.Color(hex);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 32, 64);
  g.fillStyle = `#${base.clone().lerp(new THREE.Color("#ffffff"), 0.35).getHexString()}`;
  g.fillRect(0, 0, 32, 10);
  g.fillStyle = `#${base.clone().multiplyScalar(0.62).getHexString()}`;
  g.fillRect(0, 52, 32, 12);
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(0, 62, 32, 2);
  // Small ventilation slots, every slat.
  g.fillStyle = "rgba(0,0,0,0.28)";
  for (let x = 4; x < 32; x += 8) g.fillRect(x, 26, 4, 3);
  return finish(new THREE.CanvasTexture(c), anisotropy);
}
