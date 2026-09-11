"use client";

import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

export function SkeletonContainer({ className = "", children }: SkeletonProps) {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`} aria-busy="true" aria-label="Caricamento">
      {children}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="border-b border-[var(--color-border)] pb-4">
      <div className="h-7 w-64 rounded-lg bg-[var(--color-bg-alt)]" />
      <div className="mt-2 h-4 w-96 max-w-full rounded bg-[var(--color-bg-alt)]" />
    </div>
  );
}

export function SkeletonKPIs({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--color-border)] p-4">
          <div className="h-3 w-24 rounded bg-[var(--color-bg-alt)]" />
          <div className="mt-3 h-7 w-28 rounded-lg bg-[var(--color-bg-alt)]" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRow({ cells = 4, hasActions = false }: { cells?: number; hasActions?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3 last:border-0">
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className={`h-4 rounded bg-[var(--color-bg-alt)] ${i === 0 ? "w-1/3" : i === 1 ? "w-1/4" : "w-1/5"}`} />
      ))}
      {hasActions && <div className="h-4 w-16 rounded bg-[var(--color-bg-alt)]" />}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cells = 4, hasActions = true }: { rows?: number; cells?: number; hasActions?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="h-4 w-48 rounded bg-[var(--color-bg-alt)]" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cells={cells} hasActions={hasActions} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] p-5 ${className}`}>
      <div className="h-4 w-32 rounded bg-[var(--color-bg-alt)]" />
      <div className="mt-3 h-4 w-48 rounded bg-[var(--color-bg-alt)]" />
      <div className="mt-2 h-4 w-64 rounded bg-[var(--color-bg-alt)]" />
    </div>
  );
}

export function SkeletonCardGrid({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid gap-4 ${cols === 2 ? "grid-cols-1 sm:grid-cols-2" : cols === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="h-10 w-full rounded-lg bg-[var(--color-bg-alt)]" />
      ))}
    </div>
  );
}

export function SkeletonSelect() {
  return (
    <div className="h-10 w-full rounded-lg bg-[var(--color-bg-alt)]" />
  );
}

export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ height }}>
      <div className="h-4 w-32 rounded bg-[var(--color-bg-alt)] mb-4" />
      <div className="h-full bg-[var(--color-bg-alt)] rounded" />
    </div>
  );
}

export function SkeletonEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-pulse">
      <div className="h-12 w-12 rounded-full bg-[var(--color-bg-alt)] mb-4" />
      <div className="h-4 w-32 rounded bg-[var(--color-bg-alt)] mb-2" />
      <div className="h-3 w-24 rounded bg-[var(--color-bg-alt)]" />
    </div>
  );
}