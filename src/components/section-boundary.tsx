"use client";

import { Component, type ReactNode } from "react";
import { sentry as Sentry } from "@/lib/monitoring";

/**
 * Isolates an auxiliary section (e.g. usage meters): if it throws — a query
 * failing, or a backend not yet deployed — the section disappears instead of
 * taking the whole page (and its payment buttons) down with it.
 */
export class SectionBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // A section that depends on user input (e.g. the Showroom price) tries again as soon as that input changes.
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
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
