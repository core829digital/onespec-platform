"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { EmptyState } from "@/components/app-shell/empty-state";
import { checkCompanyName, checkEmail } from "@/shared/validation";
import type { PartnerRole } from "@/shared/supply";

const input = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";

export function PartnersTab({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("supply.partners");
  const tf = useFriendlyError();
  const partners = useQuery(api.supplies.listPartners, { tenantId });
  const create = useMutation(api.supplies.createPartner);
  const update = useMutation(api.supplies.updatePartner);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<PartnerRole[]>(["producer"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const nameOk = checkCompanyName(name).ok;
  const emailOk = email.trim() === "" || checkEmail(email).ok;
  const valid = nameOk && emailOk && roles.length > 0;
  const toggle = (r: PartnerRole) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setErr("");
    try {
      await create({ tenantId, name, roles, email: email.trim() || undefined });
      setName("");
      setEmail("");
      setRoles(["producer"]);
    } catch (e2) {
      setErr(tf(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <form onSubmit={submit} noValidate className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {t("name")}
          <input className={`${input} mt-1`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={name !== "" && !nameOk} />
        </label>
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {t("email")}
          <input className={`${input} mt-1`} type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} aria-invalid={!emailOk} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-medium text-[var(--color-text-secondary)]">{t("roles")}</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-[var(--color-text)]">
            {(["producer", "deliverer"] as const).map((r) => (
              <label key={r} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} className="h-4 w-4" />
                {t(r)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy || !valid} className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50">
            {busy ? "…" : t("add")}
          </button>
        </div>
      </form>

      {partners === undefined ? null : partners.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {partners.map((p) => (
            <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className={p.archived ? "opacity-60" : ""}>
                <p className="font-medium text-[var(--color-text)]">{p.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {p.roles.map((r) => t(r)).join(" · ")}
                  {p.archived ? ` · ${t("archived")}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
                onClick={() =>
                  update({ partnerId: p._id, name: p.name, roles: p.roles, contactName: p.contactName, phone: p.phone, email: p.email, notes: p.notes, archived: !p.archived }).catch((e2) => setErr(tf(e2)))
                }
              >
                {p.archived ? t("restore") : t("archive")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
