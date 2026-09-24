"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_PREVIEW_EMAIL, canPreviewMarkets, previewableRegions } from "@/lib/country-locale";
import { useRunAction } from "@/hooks/useRunAction";
import { useLocale, useTranslations } from "next-intl";

function MarketPreview() {
  const t = useTranslations("admin");
  const [region, setRegion] = useState("IT");
  const preview = useQuery(api.admin.getMarketPreview, { regionCode: region });

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold text-[var(--color-text)]">
          {t("marketPreview")} <span className="font-mono text-xs">{ADMIN_PREVIEW_EMAIL}</span>
        </span>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label={t("selectMarket")}
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
        <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
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
            <p className="font-semibold text-[var(--color-text)]">{t("installTitle", { name: preview.installation.name })}</p>
            <p className="text-[var(--color-text-secondary)]">
              {t("installLine", {
                jobs: preview.installation.jobTypes.length,
                nodes: preview.installation.nodeTypes.length,
                materials: preview.installation.materials.length,
              })}
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">{t("inspectTitle", { title: preview.inspection.title })}</p>
            <p className="text-[var(--color-text-secondary)]">{preview.inspection.legalBasis}</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">
              {t("fundingTitle", { programme: preview.funding.programme })}
            </p>
            <p className="text-[var(--color-text-secondary)]">
              {preview.funding.hasPortalXml ? t("xmlPortal") : t("signedPdf")} ·{" "}
              {preview.funding.preamble[0] ?? ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
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
    return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)]">
          {t("noAccess")}
        </p>
        <Link href="/app/dashboard" className="text-[var(--color-mint)] hover:underline">
          {t("dashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{t("regStatus")}</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
            {registration ? (registration.open ? t("openState") : t("closedState")) : "—"}
          </p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{t("totalTenants")}</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{tenants?.length ?? "—"}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">{t("registrations")}</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => run(toggleRegistration({ open: true }))}>
              {t("open")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(toggleRegistration({ open: false }))}>
              {t("close")}
            </Button>
          </div>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("dpaLabel", { state: registration ? (registration.dpaRequired ? t("dpaOn") : t("dpaOff")) : "—" })}
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => run(setDpaRequired({ required: true }))}>
              {t("activate")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(setDpaRequired({ required: false }))}>
              {t("deactivate")}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">{t("recentTenants")}</div>
        {tenants === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
        ) : (
          tenants.map((tn) => (
            <div key={tn._id} className="px-6 py-3 flex items-center justify-between text-sm gap-3">
              <span className="text-[var(--color-text)]">{tn.name}</span>
              <span className="text-[var(--color-text-secondary)] flex-1">
                {tn.plan}
                {tn.planStatus === "suspended" && (
                  <span className="ml-2 text-xs font-semibold text-red-600">{t("suspended")}</span>
                )}
              </span>
              {tn.planStatus === "suspended" ? (
                <Button size="sm" variant="ghost" onClick={() => run(reactivateTenant({ tenantId: tn._id }))}>
                  {t("reactivate")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt(t("suspendPrompt"));
                    if (reason) run(suspendTenant({ tenantId: tn._id, reason }));
                  }}
                >
                  {t("suspend")}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {canPreviewMarkets(viewer?.email) && <MarketPreview />}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          {t("recentSignups")}{signups ? t("countParen", { count: signups.length }) : ""}
        </div>
        {signups === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
        ) : signups.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("noSignups")}</div>
        ) : (
          signups.map((u) => (
            <div key={u._id} className="px-6 py-3 text-sm flex items-center justify-between gap-3">
              <span className="text-[var(--color-text)]">{u.name || "—"}</span>
              <span className="text-[var(--color-text-secondary)] flex-1">{u.email}</span>
              <span className="text-[var(--color-text-secondary)] text-xs">
                {u.emailVerificationTime ? t("verified") : t("unverified")}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          {t("recentEmails")}
          <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
            {t("noopHint")}
          </span>
        </div>
        {emailLog === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
        ) : emailLog.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("noEmails")}</div>
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
                {t("resend")}
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">{t("auditLog")}</div>
        {auditStatus === "LoadingFirstPage" ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
        ) : auditRows.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("noRows")}</div>
        ) : (
          auditRows.map((a) => (
            <div key={a._id} className="px-6 py-2 text-sm flex items-center justify-between gap-3">
              <span className="text-[var(--color-text)] font-mono text-xs">{a.action}</span>
              <span className="text-[var(--color-text-secondary)] text-xs flex-1">
                {a.actorKind}
                {a.targetTable ? ` · ${a.targetTable}` : ""}
              </span>
              <span className="text-[var(--color-text-secondary)] text-xs">
                {new Date(a.createdAt).toLocaleString(locale)}
              </span>
            </div>
          ))
        )}
        {auditStatus === "CanLoadMore" && (
          <div className="px-6 py-3 text-center">
            <Button size="sm" variant="ghost" onClick={() => loadMoreAudit(15)}>
              {t("showOlder")}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">
          {t("feedbackTitle")}{feedback ? t("feedbackNew", { count: feedback.filter((f) => f.status === "new").length }) : ""}
        </div>
        {feedback === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
        ) : feedback.length === 0 ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">{t("noFeedback")}</div>
        ) : (
          feedback.slice(0, 40).map((f) => (
            <div key={f._id} className="px-6 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-text-secondary)] text-xs">
                  {f.category} · {f.userEmail ?? "—"} · {new Date(f.createdAt).toLocaleString(locale)}
                  {f.pagePath ? ` · ${f.pagePath}` : ""}
                </span>
                <select
                  value={f.status}
                  onChange={(e) =>
                    run(setFeedbackStatus({ id: f._id, status: e.target.value as "new" | "triaged" | "closed" }))
                  }
                  className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-xs text-[var(--color-text)]"
                >
                  <option value="new">{t("statusNew")}</option>
                  <option value="triaged">{t("statusTriaged")}</option>
                  <option value="closed">{t("statusClosed")}</option>
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
