"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";

interface Props {
  tenantId: Id<"tenants">;
  version: string;
  companyName: string;
  controllerComplete: boolean;
  onAccepted?: () => void;
}

/** Signer identity + explicit consent + the accept button. */
export function DpaAcceptForm({ tenantId, version, companyName, controllerComplete, onAccepted }: Props) {
  const t = useTranslations("dpa");
  const tf = useFriendlyError();
  const accept = useMutation(api.dpa.acceptDpa);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = controllerComplete && read && signerName.trim().length >= 2 && signerRole.trim().length >= 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await accept({ tenantId, version, signerName, signerRole });
      onAccepted?.();
    } catch (err) {
      setError(tf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!controllerComplete ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-[var(--color-text)]">
          {t("companyIncomplete")}{" "}
          <Link href="/app/account" className="font-semibold text-[var(--color-mint)] hover:underline">
            {t("goToCompany")}
          </Link>
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-text)]">{t("signerName")}</span>
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-text)]">{t("signerRole")}</span>
          <input
            value={signerRole}
            onChange={(e) => setSignerRole(e.target.value)}
            maxLength={80}
            placeholder={t("signerRolePlaceholder")}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-1" />
        <span>{t("consent", { company: companyName })}</span>
      </label>
      <button
        type="submit"
        disabled={!ready || busy}
        className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
      >
        {busy ? t("accepting") : t("accept")}
      </button>
    </form>
  );
}
