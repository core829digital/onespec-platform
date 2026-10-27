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
