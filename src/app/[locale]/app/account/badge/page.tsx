"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";

export default function BadgePage() {
  const tenant = useQuery(api.tenants.getMyTenant);

  if (tenant && !tenant.isAlpha) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Badge Alpha</h1>
        <p className="text-[var(--color-text-secondary)]">
          Il badge Alpha Member è riservato ai primi 250 iscritti.
        </p>
        <Link href="/app/account" className="text-[var(--color-mint)] hover:underline">
          ← Torna all&apos;account
        </Link>
      </div>
    );
  }

  const badgeSnippet = `<a href="https://onespec.it" target="_blank" rel="noopener">
  <img src="https://onespec.it/alpha-badge.svg" alt="onespec Alpha Member" width="160" />
</a>`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/app/account" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ←
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Badge Alpha Member</h1>
      </div>

      <div className="bg-gradient-to-br from-[var(--color-mint)]/10 to-transparent border border-[var(--color-mint)] rounded-xl p-8 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-mint)]/20 text-[var(--color-mint)] font-medium">
          <span className="w-2 h-2 rounded-full bg-[var(--color-mint)]" />
          Alpha Member #{tenant?.alphaSeatNumber}
        </span>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--color-text)] mb-1">Snippet per il tuo sito</p>
        <pre className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 overflow-x-auto">
          {badgeSnippet}
        </pre>
      </div>
    </div>
  );
}
