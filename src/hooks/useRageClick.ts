"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";
import React from "react";

interface RageClickConfig {
  threshold: number;
  windowMs: number;
  onRageClick?: (event: MouseEvent, count: number) => void;
}

const DEFAULT_CONFIG: RageClickConfig = {
  threshold: 5,
  windowMs: 2000,
};

export function useRageClick(config: Partial<RageClickConfig> = {}) {
  const { threshold, windowMs, onRageClick } = { ...DEFAULT_CONFIG, ...config };
  const clicksRef = useRef<number[]>([]);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const now = Date.now();
      const clicks = clicksRef.current.filter((t) => now - t < windowMs);
      clicks.push(now);
      clicksRef.current = clicks;

      if (clicks.length >= threshold) {
        console.warn(`[RageClick] Detected ${clicks.length} clicks in ${windowMs}ms`, {
          element: event.target,
          count: clicks.length,
          windowMs,
        });

        Sentry.addBreadcrumb({
          category: "ux.rage-click",
          message: `Rage click detected: ${clicks.length} clicks in ${windowMs}ms`,
          level: "warning",
          data: {
            clickCount: clicks.length,
            windowMs,
            target: event.target instanceof HTMLElement ? event.target.tagName : "unknown",
            targetId: event.target instanceof HTMLElement ? event.target.id : undefined,
            targetClass: event.target instanceof HTMLElement ? event.target.className : undefined,
          },
        });

        Sentry.captureMessage("Rage click detected", {
          level: "warning",
          tags: {
            feature: "ux-rage-click",
            clickCount: String(clicks.length),
          },
          extra: {
            clickCount: clicks.length,
            windowMs,
            timestamp: new Date().toISOString(),
          },
        });

        if (onRageClick) {
          onRageClick(event, clicks.length);
        }

        clicksRef.current = [];
      }
    },
    [threshold, windowMs, onRageClick]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [handleClick]);

  return { handleClick };
}

interface RageClickDetectorProps {
  children: React.ReactNode;
  config?: Partial<RageClickConfig>;
}

export function RageClickDetector({ children, config }: RageClickDetectorProps) {
  useRageClick(config);
  return React.createElement(React.Fragment, null, children);
}