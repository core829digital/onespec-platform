"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Download, FileText, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/navigation";
import { EmptyState } from "@/components/app-shell/empty-state";
import { SurveyPDF, type SurveyPdfLabels } from "@/lib/pdfs/SurveyPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";
import { useCompanyPdf } from "@/lib/use-company-pdf";
import { useFriendlyError } from "@/lib/use-friendly-error";

const LABEL_KEYS: Array<keyof SurveyPdfLabels> = [
  "title", "customer", "address", "status", "date", "openings", "colLabel", "colWidth", "colHeight",
  "colRoom", "colFloor", "colNotes", "perimeter", "diagnostics", "wallType", "counterFrame", "mould",
  "floorAccess", "existingShutter", "crane", "recommendation", "notes", "photos", "yes", "no",
  "generatedOn", "statusDraft", "statusCompleted",
];

export default function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const surveyId = id as Id<"siteSurveys">;
  const t = useTranslations("surveyDoc");
  const tf = useTranslations("folder");
  const locale = useLocale();
  const router = useRouter();
  const toMessage = useFriendlyError();

  const tenant = useQuery(api.tenants.getMyTenant);
  const data = useQuery(api.surveys.getForPrint, { surveyId });
  const configurators = useQuery(
    api.configurators.listConfigurators,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const publishedConfig = useMemo(
    () => (configurators ?? []).find((c) => c.status === "published"),
    [configurators],
  );
  const complete = useMutation(api.surveys.completeSurvey);
  const remove = useMutation(api.surveys.remove);
  const createQuote = useMutation(api.quotes.createFieldQuoteFromSurvey);
  const saveRecommendation = useMutation(api.surveys.saveDiagnosticRecommendation);
  const updateSurvey = useMutation(api.surveys.update);
  const [recommendationDraft, setRecommendationDraft] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    customerName: "",
    customerAddress: "",
    customerCity: "",
    customerPostalCode: "",
  });

  const { downloadPDF } = usePDFDownload(SurveyPDF, {
    filename: `rilievo-${id.slice(-6)}.pdf`,
  });
  const { ready: companyReady, company } = useCompanyPdf(data?.tenant?.name);
  const [busy, setBusy] = useState<"" | "pdf" | "complete" | "quote" | "delete" | "recommendation" | "customer">("");
  const [error, setError] = useState("");

  if (data === undefined) return <p className="text-[var(--color-text-secondary)]">{tf("loading")}</p>;
  if (data === null) {
    return (
      <EmptyState
        title={tf("notFound")}
        action={<Link href="/app/surveys" className="text-[var(--color-mint)] hover:underline">{t("back")}</Link>}
      />
    );
  }

  const { survey } = data;
  const isCompleted = survey.status === "completed";

  async function run(kind: typeof busy, action: () => Promise<unknown>) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy("");
    }
  }

  const labels = Object.fromEntries(LABEL_KEYS.map((k) => [k, t(k)])) as unknown as SurveyPdfLabels;

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/app/surveys"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{survey.customerName}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {isCompleted ? t("statusCompleted") : t("statusDraft")}
          </span>
          {survey.clientId && (
            <Link href={`/app/clients/${survey.clientId}`} className="text-sm text-[var(--color-mint)] hover:underline">
              {t("client")}
            </Link>
          )}
          {survey.quoteId && (
            <Link href={`/app/quotes/${survey.quoteId}/print`} className="text-sm text-[var(--color-mint)] hover:underline">
              {t("linkedQuote")}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== "" || !companyReady}
          onClick={() =>
            run("pdf", () =>
              downloadPDF({
                tenant: company,
                survey,
                labels,
                locale,
                generatedAt: Date.now(),
              }),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-alt)] disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {busy === "pdf" ? t("downloading") : t("download")}
        </button>
        {!isCompleted && (
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => {
              if (window.confirm(t("completeConfirm"))) void run("complete", () => complete({ surveyId }));
            }}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {t("complete")}
          </button>
        )}
        {isCompleted && !survey.quoteId && (
          <button
            type="button"
            disabled={busy !== "" || !publishedConfig || !tenant}
            title={!publishedConfig ? t("noQuoteConfig") : undefined}
            onClick={() =>
              void run("quote", async () => {
                if (!tenant || !publishedConfig) return;
                const res = await createQuote({ tenantId: tenant._id, surveyId, configuratorId: publishedConfig._id });
                router.push(`/app/quotes/${res.quoteId}/print`);
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> {t("generateQuote")}
          </button>
        )}
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => {
            if (window.confirm(t("deleteConfirm")))
              void run("delete", async () => {
                await remove({ surveyId });
                router.push("/app/surveys");
              });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> {t("delete")}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}

      {!isCompleted && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          {editingCustomer ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">{t("editCustomer")}</h2>
              {(
                [
                  ["customerName", t("customer"), survey.customerName],
                  ["customerAddress", t("address"), survey.customerAddress],
                  ["customerCity", t("city"), survey.customerCity],
                  ["customerPostalCode", t("postalCode"), survey.customerPostalCode],
                ] as const
              ).map(([field, label, current]) => (
                <label key={field} className="block text-xs text-[var(--color-text-secondary)]">
                  {label}
                  <input
                    value={customerDraft[field] || (current ?? "")}
                    onChange={(e) => setCustomerDraft((d) => ({ ...d, [field]: e.target.value }))}
                    className="mt-0.5 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  />
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== ""}
                  onClick={() =>
                    void run("customer", async () => {
                      await updateSurvey({
                        surveyId,
                        customerName: customerDraft.customerName || survey.customerName,
                        customerAddress: customerDraft.customerAddress || undefined,
                        customerCity: customerDraft.customerCity || undefined,
                        customerPostalCode: customerDraft.customerPostalCode || undefined,
                      });
                      setCustomerDraft({ customerName: "", customerAddress: "", customerCity: "", customerPostalCode: "" });
                      setEditingCustomer(false);
                    })
                  }
                  className="rounded-lg bg-[var(--color-mint)] px-3 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
                >
                  {busy === "customer" ? "…" : t("save")}
                </button>
                <button
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => {
                    setCustomerDraft({ customerName: "", customerAddress: "", customerCity: "", customerPostalCode: "" });
                    setEditingCustomer(false);
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy !== ""}
              onClick={() => setEditingCustomer(true)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-bg)] disabled:opacity-50"
            >
              {t("editCustomer")}
            </button>
          )}
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
        <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold">{t("openings")}</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">{t("colLabel")}</th>
              <th className="px-4 py-2 text-right">{t("colWidth")}</th>
              <th className="px-4 py-2 text-right">{t("colHeight")}</th>
              <th className="px-4 py-2 text-left">{t("colRoom")}</th>
              <th className="px-4 py-2 text-left">{t("colNotes")}</th>
            </tr>
          </thead>
          <tbody>
            {survey.openings.map((o, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 font-medium">{o.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{o.widthMm}</td>
                <td className="px-4 py-2 text-right tabular-nums">{o.heightMm}</td>
                <td className="px-4 py-2">{[o.room, o.floor].filter(Boolean).join(" · ")}</td>
                <td className="px-4 py-2 text-[var(--color-text-secondary)]">{o.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("diagnostics")}</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {([
            [t("wallType"), survey.diagnostics.wallType],
            [t("counterFrame"), survey.diagnostics.counterFrame],
            [t("floorAccess"), survey.diagnostics.floorAccess],
            [t("mould"), survey.diagnostics.mould ? t("yes") : t("no")],
            [t("existingShutter"), survey.diagnostics.existingShutter ? t("yes") : t("no")],
            [t("crane"), survey.diagnostics.craneRequired ? t("yes") : t("no")],
            [t("notes"), survey.diagnostics.notes],
          ] as Array<[string, string | undefined]>)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-[var(--color-text-secondary)]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>

        <div className="mt-3">
          <dt className="text-xs text-[var(--color-text-secondary)]">{t("recommendation")}</dt>
          {isCompleted ? (
            <dd>{survey.diagnostics.recommendation}</dd>
          ) : (
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
              <textarea
                value={recommendationDraft ?? survey.diagnostics.recommendation ?? ""}
                onChange={(e) => setRecommendationDraft(e.target.value)}
                rows={2}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy !== "" || recommendationDraft === null}
                onClick={() =>
                  void run("recommendation", async () => {
                    await saveRecommendation({ surveyId, recommendation: recommendationDraft ?? "" });
                    setRecommendationDraft(null);
                  })
                }
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-bg-alt)] disabled:opacity-50"
              >
                {t("save")}
              </button>
            </div>
          )}
        </div>
      </section>

      {survey.photos.some((p) => p.url) && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("photos")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {survey.photos.map(
              (p, i) =>
                p.url && (
                  // Natural aspect ratio, never cropped or resized by us.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p.url} alt="" className="h-auto w-full rounded-lg border border-[var(--color-border)] object-contain" />
                ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
