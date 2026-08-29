"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }, []);

  if (!convex) return children;

  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
