"use client";

import type { ReactNode } from "react";

const base = "w-full rounded-lg border bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint)]/50";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Message to show (already translated) once the field was touched; null/undefined = valid so far. */
  error?: string | null;
  hint?: string;
  type?: "text" | "email" | "tel" | "url";
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  optional?: boolean;
  optionalText?: string;
  mono?: boolean;
  disabled?: boolean;
}

/** A labelled input whose error and hint are read out by screen readers (aria-invalid + aria-describedby). */
export function Field({ id, label, value, onChange, onBlur, error, hint, type = "text", inputMode, autoComplete, maxLength, placeholder, optional, optionalText, mono, disabled }: FieldProps) {
  const describedBy = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
        {optional ? <span className="ml-1 font-normal">({optionalText})</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${base} ${mono ? "font-mono" : ""} ${error ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</label>
      <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${base} border-[var(--color-border)]`}>
        {children}
      </select>
    </div>
  );
}
