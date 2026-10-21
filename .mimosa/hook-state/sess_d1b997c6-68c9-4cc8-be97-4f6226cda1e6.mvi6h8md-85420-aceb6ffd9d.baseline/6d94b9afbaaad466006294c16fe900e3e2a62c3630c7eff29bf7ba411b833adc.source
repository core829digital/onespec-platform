"use client";

import { useEffect, useState } from "react";
import { Logo } from "./logo";

/**
 * Branded "entering the platform" screen — shown once, right after the
 * onboarding wizard completes, while the dashboard's own data loads.
 *
 * The isometric cube here is a from-scratch CSS/SVG recreation (pure
 * geometry + brand mint token, no external asset) — this repo doesn't
 * have the actual cube mark used on onespec.eu (that site is a separate
 * repository not reachable from here). If you have the real SVG/Lottie
 * file, drop it in and swap the <Cube /> below for it directly; the
 * rotation/glow choreography stays the same either way.
 */
export function OneSpecLoadingScreen({ messages }: { messages: string[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % messages.length), 1700);
    return () => window.clearInterval(id);
  }, [messages.length]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[var(--color-bg)]">
      <Logo className="h-8" />
      <Cube />
      <div className="flex flex-col items-center gap-3">
        <p aria-live="polite" className="text-sm font-medium text-[var(--color-text-secondary)] transition-opacity">
          {messages[step]}
        </p>
        <div className="flex gap-1.5">
          {messages.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i === step ? "var(--color-mint)" : "var(--color-border)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Cube() {
  return (
    <div className="onespec-cube" aria-hidden="true">
      <div className="onespec-cube-scene">
        <div className="onespec-cube-face onespec-cube-face--top" />
        <div className="onespec-cube-face onespec-cube-face--left" />
        <div className="onespec-cube-face onespec-cube-face--right" />
      </div>
      <style>{`
        .onespec-cube {
          width: 72px;
          height: 72px;
          perspective: 400px;
        }
        .onespec-cube-scene {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: onespec-cube-spin 2.4s linear infinite;
        }
        .onespec-cube-face {
          position: absolute;
          width: 44px;
          height: 44px;
        }
        .onespec-cube-face--top {
          top: 0; left: 14px;
          background: var(--color-mint);
          opacity: 0.95;
          transform: rotateX(60deg) rotateZ(45deg);
          border-radius: 4px;
        }
        .onespec-cube-face--left {
          top: 28px; left: 0;
          background: var(--color-mint);
          opacity: 0.55;
          transform: rotateX(-30deg) rotateY(-30deg) skew(-20deg, 10deg);
          border-radius: 4px;
        }
        .onespec-cube-face--right {
          top: 28px; left: 28px;
          background: var(--color-mint);
          opacity: 0.75;
          transform: rotateX(-30deg) rotateY(30deg) skew(20deg, -10deg);
          border-radius: 4px;
        }
        @keyframes onespec-cube-spin {
          from { transform: rotateY(0deg) rotateX(8deg); }
          to { transform: rotateY(360deg) rotateX(8deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .onespec-cube-scene { animation: none; }
        }
      `}</style>
    </div>
  );
}
