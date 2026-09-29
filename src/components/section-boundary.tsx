"use client";

import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Isolates an auxiliary section (e.g. usage meters): if it throws — a query
 * failing, or a backend not yet deployed — the section disappears instead of
 * taking the whole page (and its payment buttons) down with it.
 */
export class SectionBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    try {
      Sentry.captureException(error);
    } catch {
      /* reporting must never break the UI */
    }
    console.error("section error", error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
