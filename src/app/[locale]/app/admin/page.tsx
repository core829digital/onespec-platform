"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_PREVIEW_EMAIL, canPreviewMarkets, previewableRegions } from "@/lib/country-locale";
import { useRunAction } from "@/hooks/useRunAction";

function MarketPreview() {
  const [region, setRegion] = useState("IT");
  const preview = useQuery(api.admin.getMarketPreview, { regionCode: region });

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold text-[var(--color-text)]">
          Anteprima mercato · <span className="font-mono text-xs">{ADMIN_PREVIEW_EMAIL}</span>
        </span>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Seleziona mercato"
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        >
          {previewableRegions().map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {preview === undefined ? (
        <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
      ) : (
        <div className="px-6 py-4 space-y-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent-ink)]">
              {preview.installation.norm}
            </span>
            <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs">
              widget: {preview.widgetMode}
            </span>
            <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs">
              {preview.vatRates.map((v) => `${v.percent}%`).join(" / ")}
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
              {preview.funding.title}
            </span>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">Posa — {preview.installation.name}</p>
            <p className="text-[var(--color-text-secondary)]">
              {preview.installation.jobTypes.length} tipi lavoro ·{" "}
              {preview.installation.nodeTypes.length} nodi ·{" "}
              {preview.installation.materials.length} materiali
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">Collaudo — {preview.inspection.title}</p>
            <p className="text-[var(--color-text-secondary)]">{preview.inspection.legalBasis}</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">
              Agevolazione — {preview.funding.programme}
            </p>
            <p className="text-[var(--color-text-secondary)]">
              {preview.funding.hasPortalXml ? "XML portale" : "PDF firmato"} ·{" "}
              {preview.funding.preamble[0] ?? ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const run = useRunAction();
  const viewer = useQuery(api.users.viewer);
  const isAdmin = viewer?.isPlatformAdmin === true;

  const registration = useQuery(api.registration.getRegistrationStatus, isAdmin ? {} : "skip");
  const tenants = useQuery(api.admin.listTenants, isAdmin ? { limit: 50 } : "skip");
  const feedback = useQuery(api.feedback.listFeedback, isAdmin ? {} : "skip");
  const toggleRegistration = useMutation(api.registration.toggleRegistration);
  const setDpaRequired = useMutation(api.dpa.setDpaRequired);
  const setFeedbackStatus = useMutation(api.feedback.setFeedbackStatus);
  const suspendTenant = useMutation(api.tenants.suspendTenant);
  const reactivateTenant = useMutation(api.tenants.reactivateTenant);
  const resendEmail = useMutation(api.admin.resendEmail);
  const signups = useQuery(api.admin.recentSignups, isAdmin ? { limit: 10 } : "skip");
  const emailLog = useQuery(api.admin.listEmails, isAdmin ? { limit: 20 } : "skip");
  const {
    results: auditRows,
    status: auditStatus,
    loadMore: loadMoreAudit,
  } = usePaginatedQuery(api.audit.listAudit, isAdmin ? {} : "skip", { initialNumItems: 15 });

  if (viewer === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Admin</h1>
        <p className="text-[var(--color-text-secondary)]">
          Non hai i permessi per accedere a questa area.
        </p>
        <Link href="/app/dashboard" className="text-[var(--color-mint)] hover:underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Admin</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Stato registrazioni</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
            {registration ? (registration.open ? "Aperte" : "Chiuse") : "—"}
          </p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Tenant totali</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{tenants?.length ?? "—"}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">Registrazioni</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => run(toggleRegistration({ open: true }))}>
              Apri
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(toggleRegistration({ open: false }))}>
              Chiudi
            </Button>
          </div>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Accordo DPA obbligatorio: {registration ? (registration.dpaRequired ? "attivo" : "spento") : "—"}
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => run(setDpaRequired({ required: true }))}>
              Attiva
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(setDpaRequired({ required: false }))}>
              Spegni
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">Tenant recenti</div>
        {tenants === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : (
          tenants.map((tn) => (
            <div key={tn._id} className="px-6 py-3 flex items-center justify-between text-sm gap-3">
              <span className="text-[var(--color-text)]">{tn.name}</span>
              <span className="text-[var(--color-text-secondary)] flex-1">
                {tn.plan}
                {tn.planStatus === "suspended" && (
                  <span className="ml-2 text-xs font-semibold text-red-600">sospeso</span>
                )}
              </span>
              {tn.planStatus === "suspended" ? (
                <Button size="sm" variant="ghost" onClick={() => run(reactivateTenant({ tenantId: tn._id }))}>
                  Riattiva
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt("Motivo della sospensione:");
                    if (reason) run(suspendTenant({ tenantId: tn._id, reason }));
                  }}
                >
                  Sospendi
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {canPreviewMarkets(viewer?.email) && <MarketPreview />}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          Ultime registrazioni{signups ? ` (${signups.length})` : ""}
        </div>
        {signups === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : signups.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Nessuna registrazione.</div>
        ) : (
          signups.map((u) => (
            <div key={u._id} className="px-6 py-3 text-sm flex items-center justify-between gap-3">
              <span className="text-[var(--color-text)]">{u.name || "—"}</span>
              <span className="text-[var(--color-text-secondary)] flex-1">{u.email}</span>
              <span className="text-[var(--color-text-secondary)] text-xs">
                {u.emailVerificationTime ? "verificata" : "non verificata"}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          Email transazionali recenti
          <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
            stato “noop” = mail spente (RESEND_MODE non live), solo log
          </span>
        </div>
        {emailLog === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : emailLog.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Nessuna email registrata.</div>
        ) : (
          emailLog.map((e) => (
            <div key={e._id} className="px-6 py-3 text-sm flex items-center justify-between gap-3">
              <span className="text-[var(--color-text)]">{e.template}</span>
              <span className="text-[var(--color-text-secondary)] flex-1">{e.to}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  e.status === "sent"
                    ? "bg-emerald-100 text-emerald-800"
                    : e.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {e.status}
              </span>
              <Button size="sm" variant="ghost" onClick={() => run(resendEmail({ emailLogId: e._id }))}>
                Reinvia
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">Audit log</div>
        {auditStatus === "LoadingFirstPage" ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : auditRows.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Nessuna riga.</div>
        ) : (
          auditRows.map((a) => (
            <div key={a._id} className="px-6 py-2 text-sm flex items-center justify-between gap-3">
              <span className="text-[var(--color-text)] font-mono text-xs">{a.action}</span>
              <span className="text-[var(--color-text-secondary)] text-xs flex-1">
                {a.actorKind}
                {a.targetTable ? ` · ${a.targetTable}` : ""}
              </span>
              <span className="text-[var(--color-text-secondary)] text-xs">
                {new Date(a.createdAt).toLocaleString("it-IT")}
              </span>
            </div>
          ))
        )}
        {auditStatus === "CanLoadMore" && (
          <div className="px-6 py-3 text-center">
            <Button size="sm" variant="ghost" onClick={() => loadMoreAudit(15)}>
              Mostra meno recenti
            </Button>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          Feedback utenti{feedback ? ` (${feedback.filter((f) => f.status === "new").length} nuovi)` : ""}
        </div>
        {feedback === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : feedback.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Nessun feedback.</div>
        ) : (
          feedback.slice(0, 40).map((f) => (
            <div key={f._id} className="px-6 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-text-secondary)] text-xs">
                  {f.category} · {f.userEmail ?? "—"} · {new Date(f.createdAt).toLocaleString("it-IT")}
                  {f.pagePath ? ` · ${f.pagePath}` : ""}
                </span>
                <select
                  value={f.status}
                  onChange={(e) =>
                    run(setFeedbackStatus({ id: f._id, status: e.target.value as "new" | "triaged" | "closed" }))
                  }
                  className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-xs text-[var(--color-text)]"
                >
                  <option value="new">nuovo</option>
                  <option value="triaged">preso in carico</option>
                  <option value="closed">chiuso</option>
                </select>
              </div>
              <p className="text-[var(--color-text)] mt-1 whitespace-pre-wrap">{f.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
