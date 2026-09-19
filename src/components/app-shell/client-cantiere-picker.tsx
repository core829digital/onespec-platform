"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";

export interface PickedLinks {
  clientId: Id<"clients"> | undefined;
  cantiereId: Id<"cantieri"> | undefined;
  /** The full client record, so the parent can prefill name/contact/address. */
  client: Doc<"clients"> | undefined;
}

/**
 * The single "pick the client once, never retype it" control shared by every
 * creation form (quotes, surveys, inspections, installations, cantieri).
 *
 * - Client dropdown, then a cantiere dropdown filtered to that client.
 * - Picking a cantiere picks its client; picking a client clears a cantiere
 *   that belongs to someone else.
 * - Reads `?clientId=` / `?cantiereId=` once on mount, so the "Create X for
 *   this client" links on a client's folder page arrive pre-selected.
 */
export function ClientCantierePicker({
  tenantId,
  clientId,
  cantiereId,
  onChange,
  disabled,
}: {
  tenantId: Id<"tenants"> | undefined;
  clientId: Id<"clients"> | undefined;
  cantiereId: Id<"cantieri"> | undefined;
  onChange: (next: PickedLinks) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("picker");
  const params = useSearchParams();
  const clients = useQuery(
    api.clients.listClients,
    tenantId ? { tenantId, limit: 200 } : "skip",
  );
  const cantieri = useQuery(
    api.cantieri.listCantieri,
    tenantId ? { tenantId, limit: 500 } : "skip",
  );
  const appliedUrl = useRef(false);

  const client = clients?.find((c) => c._id === clientId);
  const clientCantieri = (cantieri ?? []).filter((c) => !clientId || c.clientId === clientId);

  // One-shot: adopt the ids passed in the URL by the client/cantiere folder.
  useEffect(() => {
    if (appliedUrl.current || !clients || !cantieri) return;
    appliedUrl.current = true;
    if (clientId || cantiereId) return;
    const urlCantiere = params.get("cantiereId");
    const urlClient = params.get("clientId");
    const cantiere = urlCantiere ? cantieri.find((c) => c._id === urlCantiere) : undefined;
    const resolvedClientId = (cantiere?.clientId ?? urlClient ?? undefined) as Id<"clients"> | undefined;
    const resolvedClient = clients.find((c) => c._id === resolvedClientId);
    if (resolvedClient || cantiere) {
      onChange({ clientId: resolvedClient?._id, cantiereId: cantiere?._id, client: resolvedClient });
    }
  }, [clients, cantieri, clientId, cantiereId, params, onChange]);

  function pickClient(id: string) {
    const picked = clients?.find((c) => c._id === id);
    const keepCantiere = cantieri?.find((c) => c._id === cantiereId && c.clientId === picked?._id);
    onChange({ clientId: picked?._id, cantiereId: keepCantiere?._id, client: picked });
  }

  function pickCantiere(id: string) {
    const picked = cantieri?.find((c) => c._id === id);
    const owner = clients?.find((c) => c._id === (picked?.clientId ?? clientId));
    onChange({ clientId: owner?._id, cantiereId: picked?._id, client: owner });
  }

  const selectClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint)]/40 disabled:opacity-60";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</p>
        <Link href="/app/clients" className="text-xs text-[var(--color-mint)] hover:underline">
          {t("manage")}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--color-text-secondary)]">
          {t("client")}
          <select
            className={`${selectClass} mt-1`}
            value={clientId ?? ""}
            onChange={(e) => pickClient(e.target.value)}
            disabled={disabled || clients === undefined}
          >
            <option value="">{t("noClient")}</option>
            {(clients ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--color-text-secondary)]">
          {t("cantiere")}
          <select
            className={`${selectClass} mt-1`}
            value={cantiereId ?? ""}
            onChange={(e) => pickCantiere(e.target.value)}
            disabled={disabled || cantieri === undefined}
          >
            <option value="">{t("noCantiere")}</option>
            {clientCantieri.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {client ? (
        <p className="text-xs text-[var(--color-text-secondary)]">{t("prefilled", { name: client.name })}</p>
      ) : (
        <p className="text-xs text-[var(--color-text-secondary)]">{t("hint")}</p>
      )}
    </div>
  );
}
