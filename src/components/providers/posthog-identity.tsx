"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import posthog from "posthog-js";
import { api } from "@/convex/_generated/api";

export function PostHogIdentity() {
  const viewer = useQuery(api.users.viewer);
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!viewer) return;

    const userId = String(viewer._id);
    if (identifiedUserId.current && identifiedUserId.current !== userId) {
      posthog.reset();
    }

    posthog.identify(userId, {
      email: viewer.email ?? undefined,
      name: viewer.name ?? undefined,
    });
    identifiedUserId.current = userId;
  }, [viewer]);

  return null;
}
