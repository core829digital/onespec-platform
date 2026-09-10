"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_PREVIEW_EMAIL, canPreviewMarkets, previewableRegions } from "@/lib/country-locale";

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
  const viewer = useQuery(api.users.viewer);
  const isAdmin = viewer?.isPlatformAdmin === true;

  const seats = useQuery(api.admin.getSeatCount, isAdmin ? {} : "skip");
  const tenants = useQuery(api.admin.listTenants, isAdmin ? { limit: 50 } : "skip");
  const feedback = useQuery(api.feedback.listFeedback, isAdmin ? {} : "skip");
  const toggleRegistration = useMutation(api.alpha.toggleRegistration);
  const setFeedbackStatus = useMutation(api.feedback.setFeedbackStatus);

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

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Posti Alpha</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
            {seats ? `${seats.claimed} / ${seats.cap}` : "—"}
          </p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Tenant totali</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{tenants?.length ?? "—"}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">Registrazioni</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => toggleRegistration({ open: true })}>
              Apri
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleRegistration({ open: false })}>
              Chiudi
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
            <div key={tn._id} className="px-6 py-3 flex items-center justify-between text-sm">
              <span className="text-[var(--color-text)]">{tn.name}</span>
              <span className="text-[var(--color-text-secondary)]">
                {tn.isAlpha ? `Alpha #${tn.alphaSeatNumber}` : tn.plan}
              </span>
            </div>
          ))
        )}
      </div>

      {canPreviewMarkets(viewer?.email) && <MarketPreview />}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          Feedback Alpha{feedback ? ` (${feedback.filter((f) => f.status === "new").length} nuovi)` : ""}
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
                    setFeedbackStatus({ id: f._id, status: e.target.value as "new" | "triaged" | "closed" })
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
