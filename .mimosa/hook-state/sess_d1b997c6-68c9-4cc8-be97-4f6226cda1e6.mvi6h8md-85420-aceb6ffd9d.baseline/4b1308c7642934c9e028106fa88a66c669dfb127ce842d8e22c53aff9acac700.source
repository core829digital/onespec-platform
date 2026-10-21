"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { DemoConvexProvider } from "@/demo/demo-provider";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
// Created lazily and only for the real platform: on the demo host nothing connects to any backend.
let convex: ConvexReactClient | null | undefined;
function realClient(): ConvexReactClient | null {
  if (convex === undefined) convex = url ? new ConvexReactClient(url) : null;
  return convex;
}

export function ConvexClientProvider({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  if (demo) return <DemoConvexProvider>{children}</DemoConvexProvider>;
  const client = realClient();
  if (!client) {
    if (typeof window !== "undefined") {
      console.error("NEXT_PUBLIC_CONVEX_URL is not set — Convex features disabled.");
    }
    return <>{children}</>;
  }
  return <ConvexAuthNextjsProvider client={client}>{children}</ConvexAuthNextjsProvider>;
}
