"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ClientCantierePicker, type PickedLinks } from "@/components/app-shell/client-cantiere-picker";
import { useFriendlyError } from "@/lib/use-friendly-error";

export interface EditableDossier {
  _id: Id<"installationDossiers">;
  tenantId: Id<"tenants">;
  jobType: string;
  nodeType: string;
  perimeterMm: number;
  notes?: string;
  clientId?: Id<"clients">;
  cantiereId?: Id<"cantieri">;
}

/** Edit an existing installation dossier: same fields as the wizard, plus its client/cantiere link. */
export function EditDossierPanel({
  dossier,
  jobTypes,
  nodeTypes,
  onClose,
}: {
  dossier: EditableDossier;
  jobTypes: Array<{ key: string; label: string }>;
  nodeTypes: Array<{ key: string; label: string }>;
  onClose: () => void;
}) {
  const t = useTranslations("dossierEdit");
  const toMessage = useFriendlyError();
  const update = useMutation(api.installations.update);
  const [jobType, setJobType] = useState(dossier.jobType);
  const [nodeType, setNodeType] = useState(dossier.nodeType);
  const [perimeterM, setPerimeterM] = useState(dossier.perimeterMm / 1000);
  const [notes, setNotes] = useState(dossier.notes ?? "");
  const [clientId, setClientId] = useState<Id<"clients"> | undefined>(dossier.clientId);
  const [cantiereId, setCantiereId] = useState<Id<"cantieri"> | undefined>(dossier.cantiereId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleLinks = useCallback((next: PickedLinks) => {
    setClientId(next.clientId);
    setCantiereId(next.cantiereId);
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await update({
        dossierId: dossier._id,
        jobType,
        nodeType,
        perimeterMm: Math.round(perimeterM * 1000),
        notes,
        clientId: clientId ?? null,
        cantiereId: cantiereId ?? null,
      });
      onClose();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm";

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-mint)]/50 bg-[var(--color-bg-alt)] p-5">
      <h2 className="text-sm font-semibold">{t("editTitle")}</h2>
      <ClientCantierePicker
        tenantId={dossier.tenantId}
        clientId={clientId}
        cantiereId={cantiereId}
        onChange={handleLinks}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {t("jobType")}
          <select className={field} value={jobType} onChange={(e) => setJobType(e.target.value)}>
            {jobTypes.map((j) => (
              <option key={j.key} value={j.key}>{j.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t("nodeType")}
          <select className={field} value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
            {nodeTypes.map((n) => (
              <option key={n.key} value={n.key}>{n.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t("perimeter")}
          <input
            type="number"
            min={0}
            step={0.01}
            className={field}
            value={perimeterM}
            onChange={(e) => setPerimeterM(Number(e.target.value))}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          {t("notes")}
          <textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
        >
          {busy ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
