/** Small three.js helpers shared by the window, its accessories and the room. Imported only by the (lazy) 3D modules. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface Disposer {
  track<T extends { dispose(): void }>(o: T): T;
  disposeAll(): void;
}

export function makeDisposer(): Disposer {
  const list: Array<{ dispose(): void }> = [];
  return {
    track(o) {
      list.push(o);
      return o;
    },
    disposeAll() {
      for (const d of list.splice(0)) d.dispose();
    },
  };
}

/** A box with softened edges. `radius` is clamped so thin parts stay valid. */
export function rbox(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], radius = 2.5): THREE.Mesh {
  const W = Math.max(w, 0.01);
  const H = Math.max(h, 0.01);
  const D = Math.max(d, 0.01);
  const r = Math.min(radius, W / 2 - 0.001, H / 2 - 0.001, D / 2 - 0.001);
  const g = r > 0.05 ? new RoundedBoxGeometry(W, H, D, 2, r) : new THREE.BoxGeometry(W, H, D);
  return new THREE.Mesh(g, mat);
}

/** Puts a mesh by the min corner (x, y, z0) of its box. */
export function place<T extends THREE.Object3D>(o: T, x: number, y: number, z0: number, w: number, h: number, d: number): T {
  o.position.set(x + w / 2, y + h / 2, z0 + d / 2);
  return o;
}

export const rad = THREE.MathUtils.degToRad;

/** Exponential approach of `cur` to `to` (frame-rate independent). */
export function ease(cur: number, to: number, dt: number, speed = 7): number {
  const k = 1 - Math.exp(-dt * speed);
  const next = cur + (to - cur) * k;
  return Math.abs(to - next) < 0.0015 ? to : next;
}

/** Marks a mesh (and its children) as something a tap can hit, with a name the viewer reports. */
export function tagHit(o: THREE.Object3D, key: "sashIndex" | "accessory", value: number | string): void {
  o.traverse((c) => {
    c.userData[key] = value;
  });
}

/**
 * One member of a frame or sash, cut at 45° at both ends (a welded corner): a trapezoid in the XY plane, extruded `depth` along Z.
 * `corners` are its four corners in the frame's coordinates (the two long edges are the outer and the inner side of the profile).
 * The UVs follow the convention of the straight members (u along a horizontal bar, v along a vertical one, 0..1 over the piece), so the
 * same materials and the same texture repeats work on both, and the grain changes direction at the mitre like real welded profiles.
 * A small bevel softens the edges and leaves a faint groove along the weld.
 */
export function mitreMember(corners: ReadonlyArray<readonly [number, number]>, depth: number, horizontal: boolean, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const shape = new THREE.Shape();
  corners.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const across = horizontal ? maxY - minY : maxX - minX;
  const bev = Math.max(0.2, Math.min(1.6, across / 5, depth / 5));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.2, depth - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, bev);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const rx = Math.max(maxX - minX, 0.001);
  const ry = Math.max(maxY - minY, 0.001);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const fx = Math.min(1, Math.max(0, (x - minX) / rx));
    const fy = Math.min(1, Math.max(0, (y - minY) / ry));
    const cap = Math.abs(nor.getZ(i)) > 0.5;
    const fz = Math.min(1, Math.max(0, z / Math.max(depth, 0.001)));
    const along = horizontal ? fx : fy;
    const acr = cap ? (horizontal ? fy : fx) : fz;
    uv[i * 2] = horizontal ? along : acr;
    uv[i * 2 + 1] = horizontal ? acr : along;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return new THREE.Mesh(g, mat);
}

/** The four mitred members of a rectangular frame `w` x `h` with a profile face `f`, in the order top, bottom, left, right. */
export function frameCorners(w: number, h: number, f: number): Array<Array<[number, number]>> {
  return [
    [[0, h], [w, h], [w - f, h - f], [f, h - f]],
    [[0, 0], [w, 0], [w - f, f], [f, f]],
    [[0, 0], [0, h], [f, h - f], [f, f]],
    [[w, 0], [w, h], [w - f, h - f], [w - f, f]],
  ];
}
