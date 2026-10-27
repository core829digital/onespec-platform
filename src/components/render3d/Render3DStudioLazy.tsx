"use client";

import dynamic from "next/dynamic";
import type { Render3DStudioProps } from "./Render3DStudio";

/** three.js is heavy: nothing of it is downloaded until the 3D is opened. The loading state is already the full-screen layer. */
const Studio = dynamic(() => import("./Render3DStudio").then((m) => m.Render3DStudio), {
  ssr: false,
  loading: () => (
    <div role="status" aria-busy="true" style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "#0b0f12" }} />
  ),
});

export function Render3DStudioLazy(props: Render3DStudioProps) {
  return <Studio {...props} />;
}
