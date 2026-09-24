"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useRunAction } from "@/hooks/useRunAction";

type PassportId = Id<"serramentoPassports">;

interface EneaData {
  kind?: "enea" | "declaration";
  title?: string;
  programme?: string;
  zone?: string;
  gradiGiorno?: number;
  uwPost?: number;
  uwLimit?: number;
  conform?: boolean;
  risparmioKwhAnno?: number;
  uwAnte?: number;
  deltaU?: number;
  superficieM2?: number;
  costoCents?: number;
  deductionPercent?: number;
  preamble?: string[];
}

function eur(cents: number | null | undefined, locale = "it") {
  if (cents == null) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

function PassportPanel({ passportId, tenantId }: { passportId: PassportId; tenantId: Id<"tenants"> }) {
  const t = useTranslations("passports");
  const locale = useLocale();
  const p = useQuery(api.passports.get, { passportId });
  const genUrl = useMutation(api.passports.generateUploadUrl);
  const attach = useMutation(api.passports.attachDocument);
  const setMaintenance = useMutation(api.passports.setMaintenance);
  const generateFundingDoc = useMutation(api.passports.generateFundingDoc);
  const linkQuote = useMutation(api.passports.linkQuote);
  const quotes = useQuery(api.quotes.listRequests, { tenantId, limit: 200 });
  const toMessage = useFriendlyError();
  const [quoteToLink, setQuoteToLink] = useState("");
  const [fundingBusy, setFundingBusy] = useState(false);
  const [uwAnteInput, setUwAnteInput] = useState<number | "">("");
  const [deductionPercentInput, setDeductionPercentInput] = useState<number | "">("");

  const [qr, setQr] = useState("");
  const [err, setErr] = useState("");

  const publicUrl =
    typeof window !== "undefined" && p ? `${window.location.origin}/f/${p.publicToken}` : "";

  useEffect(() => {
    if (publicUrl) QRCode.toDataURL(publicUrl, { margin: 1, width: 220 }).then(setQr).catch(() => {});
  }, [publicUrl]);

  if (!p) return <p className="text-sm text-[var(--color-muted-fg)]">{t("loading")}</p>;

  async function uploadDoc(key: string, file: File) {
    setErr("");
    try {
      const url = await genUrl({ tenantId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      await attach({ passportId, key, storageId });
    } catch (e) {
      setErr(toMessage(e));
    }
  }

  const shortPrice = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

  return (
    <div className="grid gap-5 rounded-xl border border-[var(--color-border)] p-5 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR" className="w-full rounded-lg border border-[var(--color-border)] bg-white p-2" />
        ) : (
          <div className="grid aspect-square place-items-center rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-muted-fg)]">
            QR…
          </div>
        )}
        <div className="break-all rounded bg-[var(--color-muted)] px-2 py-1 font-mono text-[11px]">
          {publicUrl}
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(publicUrl)}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          {t("copyLink")}
        </button>
        <p className="text-[11px] text-[var(--color-muted-fg)]">
          {t("qrHint")}
        </p>
        <p className="text-xs">{t("scans", { count: p.scanCount })}</p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold">{p.label}</div>
          <div className="text-xs text-[var(--color-muted-fg)]">
            {p.customerName} · {p.performanceDeclaration ?? ""}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-fg)]">
            {t("docsTitle")}
          </h3>
          <div className="space-y-2">
            {p.documents.map((d) => (
              <div
                key={d.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <span>
                  {d.label}
                  {d.required && <span className="ml-1 text-red-500">*</span>}
                </span>
                <span className="flex items-center gap-2">
                  {d.resolvedUrl ? (
                    <a
                      href={d.resolvedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-600 underline"
                    >
                      {t("attached")}
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--color-muted-fg)]">{t("missing")}</span>
                  )}
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadDoc(d.key, f);
                    }}
                    className="w-40 text-xs"
                  />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{p.regionCode === "IT" ? t("fundingIT") : t("fundingOther")}</div>
              <button
                onClick={async () => {
                  setFundingBusy(true);
                  setErr("");
                  try {
                    await generateFundingDoc({
                      passportId,
                      uwAnte: uwAnteInput || undefined,
                      deductionPercent: deductionPercentInput || undefined,
                    });
                  } catch (e) {
                    setErr(toMessage(e));
                  } finally {
                    setFundingBusy(false);
                  }
                }}
                disabled={fundingBusy || !p.quoteId}
                title={!p.quoteId ? t("linkFirstTitle") : undefined}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-50"
              >
                {fundingBusy ? t("generating") : p.eneaData ? t("regenerate") : t("generate")}
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-[var(--color-muted-fg)]">{t("uwAnteLabel")}</span>
                <input
                  type="number"
                  step="0.01"
                  value={uwAnteInput}
                  onChange={(e) => setUwAnteInput(e.target.value ? parseFloat(e.target.value) : "")}
                  className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5"
                  placeholder={t("uwAntePlaceholder")}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[var(--color-muted-fg)]">{t("deductionLabel")}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={deductionPercentInput}
                  onChange={(e) => setDeductionPercentInput(e.target.value ? parseInt(e.target.value, 10) : "")}
                  className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5"
                  placeholder={t("deductionPlaceholder")}
                />
              </label>
            </div>
            {p.eneaData && (
              <div className="mt-2 space-y-1 text-xs">
                {p.regionCode === "IT" && (p.eneaData as EneaData).zone && (
                  <div>
                    Zona {(p.eneaData as EneaData).zone} · GG {(p.eneaData as EneaData).gradiGiorno} · Uw {(p.eneaData as EneaData).uwPost} ≤{" "}
                    {(p.eneaData as EneaData).uwLimit} ·{" "}
                    <span className={(p.eneaData as EneaData).conform ? "text-emerald-600" : "text-red-600"}>
                      {(p.eneaData as EneaData).conform ? t("conform") : t("nonConform")}
                    </span>
                  </div>
                )}
                {p.regionCode !== "IT" && (
                  <>
                    <div>{t("programme", { value: p.eneaData.programme ?? "—" })}</div>
                    <div>{t("uwBefore", { value: (p.eneaData as EneaData).uwAnte ?? "—" })}</div>
                    <div>{t("uwAfter", { value: (p.eneaData as EneaData).uwPost ?? "—" })}</div>
                    <div>{t("deltaU", { value: (p.eneaData as EneaData).deltaU ?? "—" })}</div>
                    <div>{t("area", { value: (p.eneaData as EneaData).superficieM2 ?? "—" })}</div>
                    <div>{t("cost", { value: eur((p.eneaData as EneaData).costoCents, locale) })}</div>
                    <div>{t("deduction", { value: (p.eneaData as EneaData).deductionPercent ?? "—" })}</div>
                    {(p.eneaData as EneaData).preamble && (
                      <div>
                        {(p.eneaData as EneaData).preamble!.map((line: string, i: number) => (
                          <div key={i} className="text-[10px] text-[var(--color-muted-fg)]">{line}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {(p.eneaData as EneaData).risparmioKwhAnno && (
                  <div>{t("savingEst", { value: (p.eneaData as EneaData).risparmioKwhAnno ?? "—" })}</div>
                )}
                {p.eneaXml && (
                  <button
                    onClick={() => navigator.clipboard?.writeText(p.eneaXml ?? "")}
                    className="rounded border border-[var(--color-border)] px-2 py-1"
                  >
                    {t("copyXml")}
                  </button>
                )}
              </div>
            )}
            {!p.quoteId && (
              <div className="mt-2 space-y-2 rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs">
                <p className="text-[var(--color-muted-fg)]">
                  {t("linkHint")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={quoteToLink}
                    onChange={(e) => setQuoteToLink(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5"
                  >
                    <option value="">{t("chooseQuote")}</option>
                    {(quotes ?? []).map((q) => (
                      <option key={q._id} value={q._id}>
                        {q.leadName} · {shortPrice(q.priceCents)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!quoteToLink}
                    onClick={async () => {
                      setErr("");
                      try {
                        await linkQuote({ passportId, quoteId: quoteToLink as Id<"quoteRequests"> });
                        setQuoteToLink("");
                      } catch (e) {
                        setErr(toMessage(e));
                      }
                    }}
                    className="rounded border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
                  >
                    {t("link")}
                  </button>
                </div>
              </div>
            )}
          </div>

        <div className="rounded-lg bg-[var(--color-muted)] p-3">
          <div className="text-sm font-semibold">{p.maintenanceLabel}</div>
          <div className="text-lg font-bold">{eur(p.maintenancePriceCents, locale)} {t("perYear")}</div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!p.maintenanceActive}
              onChange={async (e) => {
                try {
                  await setMaintenance({ passportId, active: e.target.checked });
                } catch (er) {
                  setErr(toMessage(er));
                }
              }}
            />
            {t("maintenanceActive")}
          </label>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}

export default function PassportsPage() {
  const t = useTranslations("passports");
  const locale = useLocale();
  const run = useRunAction();
  const tenant = useQuery(api.tenants.getMyTenant);
  const passports = useQuery(api.passports.list, tenant ? { tenantId: tenant._id } : "skip");
  const interventions = useQuery(
    api.passports.listInterventions,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const create = useMutation(api.passports.create);
  const updateIv = useMutation(api.passports.updateInterventionStatus);
  const quotesForCreate = useQuery(api.quotes.listRequests, tenant ? { tenantId: tenant._id, limit: 200 } : "skip");
  const toMessageTop = useFriendlyError();
  const [creating, setCreating] = useState(false);
  const [quoteId, setQuoteId] = useState("");

  const [label, setLabel] = useState("");
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState("");
  const [selected, setSelected] = useState<PassportId | null>(null);
  const [err, setErr] = useState("");

  const shortPrice = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

  async function add() {
    if (!tenant || !label.trim() || !customer.trim()) {
      setErr(t("requiredError"));
      return;
    }
    setErr("");
    setCreating(true);
    try {
      const id = await create({
        tenantId: tenant._id,
        quoteId: quoteId ? (quoteId as Id<"quoteRequests">) : undefined,
        label: label.trim(),
        customerName: customer.trim(),
        productSummary: product.trim() || undefined,
        installedAt: Date.now(),
      });
      setLabel("");
      setCustomer("");
      setProduct("");
      setQuoteId("");
      setSelected(id);
    } catch (e) {
      setErr(toMessageTop(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] p-4">
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("labelLabel")}</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("customerLabel")}</span>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("productLabel")}</span>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("quoteLabel")}</span>
          <select
            value={quoteId}
            onChange={(e) => {
              setQuoteId(e.target.value);
              const q = (quotesForCreate ?? []).find((x) => x._id === e.target.value);
              if (q && !customer.trim()) setCustomer(q.leadName);
            }}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            <option value="">{t("noneOption")}</option>
            {(quotesForCreate ?? []).map((q) => (
              <option key={q._id} value={q._id}>
                {q.leadName} · {shortPrice(q.priceCents)}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={add}
          disabled={creating}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
        >
          {creating ? t("generating") : t("newDossier")}
        </button>
        {err && <p className="w-full text-sm text-red-600">{err}</p>}
      </div>

      {selected && tenant && <PassportPanel passportId={selected} tenantId={tenant._id} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="bg-[var(--color-muted)] px-4 py-2 text-xs font-semibold text-[var(--color-muted-fg)]">
            {t("dossiers")}
          </div>
          <table className="w-full text-sm" aria-label={t("dossiers")}>
            <tbody>
              {passports?.map((p) => (
                <tr key={p._id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-medium">{p.label}</td>
                  <td className="px-4 py-3">{p.customerName}</td>
                  <td className="px-4 py-3 text-center text-xs text-[var(--color-muted-fg)]">
                    {t("scansShort", { count: p.scanCount })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setSelected(p._id)}
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                      >
                        {t("open")}
                      </button>
                      <Link
                        href={`/app/passports/${p._id}/labels`}
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                      >
                        {t("labels")}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {passports && passports.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                    {t("emptyDossiers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="bg-[var(--color-muted)] px-4 py-2 text-xs font-semibold text-[var(--color-muted-fg)]">
            {t("afterSales")}
          </div>
          <table className="w-full text-sm" aria-label={t("afterSales")}>
            <tbody>
              {interventions?.map((iv) => (
                <tr key={iv._id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{iv.kind}</div>
                    <div className="text-xs text-[var(--color-muted-fg)]">{iv.message}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={iv.status}
                      onChange={(e) =>
                        run(updateIv({
                          interventionId: iv._id,
                          status: e.target.value as "new" | "scheduled" | "closed",
                        }))
                      }
                      className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs"
                    >
                      <option value="new">new</option>
                      <option value="scheduled">scheduled</option>
                      <option value="closed">closed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {interventions && interventions.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                    {t("emptyRequests")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
