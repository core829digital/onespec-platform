"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    const url = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_CONVEX_URL : undefined;
    if (!url) {
      console.error("NEXT_PUBLIC_CONVEX_URL not set");
      return null;
    }
    try {
      return new ConvexReactClient(url);
    } catch (e) {
      console.error("Failed to init Convex client:", e);
      return null;
    }
  }, []);

  if (!convex) return <>{children}</>;

  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
