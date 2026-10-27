"use client";

import dynamic from "next/dynamic";
import type { Render3DStudioProps } from "./Render3DStudio";

/** three.js is heavy: nothing of it is downloaded until the 3D is opened. The loading state is already the full-screen layer. */
const load = () => import("./Render3DStudio");

/** Starts the download of the 3D (a hover or a focus on the button that opens it, or the page that is only about the 3D). */
export function prefetch3d(): void {
  void load().catch(() => {});
}

const Studio = dynamic(() => load().then((m) => m.Render3DStudio), {
  ssr: false,
  loading: () => (
    <div role="status" aria-busy="true" aria-label="3D" style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "#0b0f12", display: "grid", placeItems: "center" }}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(255,255,255,.18)", borderTopColor: "#16d19d", animation: "r3d-spin .8s linear infinite" }} />
      <style>{"@keyframes r3d-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){[aria-busy] span{animation:none!important}}"}</style>
    </div>
  ),
});

export function Render3DStudioLazy(props: Render3DStudioProps) {
  return <Studio {...props} />;
}
