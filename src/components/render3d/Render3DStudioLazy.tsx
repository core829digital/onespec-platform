"use client";

import dynamic from "next/dynamic";
import { render3dText } from "@/lib/render3d/render3d-text";
import type { Render3DStudioProps } from "./Render3DStudio";

/** three.js is heavy: nothing of it is downloaded until the 3D is opened. */
const Studio = dynamic(() => import("./Render3DStudio").then((m) => m.Render3DStudio), {
  ssr: false,
  loading: () => <div role="status" aria-busy="true" style={{ minHeight: 320, borderRadius: 12, background: "var(--color-bg-alt, #f3f4f6)" }} />,
});

export function Render3DStudioLazy(props: Render3DStudioProps) {
  return <Studio {...props} />;
}

export { render3dText };
