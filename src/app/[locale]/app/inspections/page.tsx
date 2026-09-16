"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Id } from "@/convex/_generated/dataModel";
import {
  enqueue,
  flushQueue,
  subscribeSyncState,
  type SyncState,
} from "@/lib/offline-sync";

type ReportId = Id<"inspectionReports">;

function SyncBadge({ state, onSync }: { state: SyncState; onSync: () => void }) {
  const t = useTranslations("inspections");
  const { isOnline, pendingCount, error } = state;
  const color = !state.isOnline
    ? "bg-amber-100 text-amber-800"
    : state.pendingCount > 0
    ? "bg-blue-100 text-blue-800"
    : "bg-emerald-100 text-emerald-700";
  const label = !state.isOnline
    ? t("offline")
    : state.pendingCount > 0
    ? `${state.pendingCount} ${t("pendingSync")}`
    : t("synced");
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      {state.isOnline && state.pendingCount > 0 && (
        <button onClick={onSync} className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          {t("syncNow")}
        </button>
      )}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </div>
  );
}

function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const t = useTranslations("inspections");
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
  }, []);

  const pt = (e: React.TouchEvent | React.MouseEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pt(e);
  }, []);
  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = ref.current!.getContext("2d")!;
      const p = pt(e);
      if (last.current) {
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      last.current = p;
      onChange(ref.current!.toDataURL("image/png"));
    },
    [onChange],
  );
  const end = useCallback(() => {
    drawing.current = false;
    last.current = null;
  }, []);

  return (
    <div>
      <canvas
        ref={ref}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="h-32 w-full touch-none rounded-lg border-2 border-[var(--color-border)] bg-white"
      />
      <button
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          onChange(null);
        }}
        className="mt-1 text-xs text-[var(--color-muted-fg)] underline"
      >
        {t("clearSignature")}
      </button>
    </div>
  );
}

function ReportEditor({ reportId, tenantId }: { reportId: ReportId; tenantId: Id<"tenants"> }) {
  const t = useTranslations("inspections");
  const report = useQuery(api.inspections.get, { reportId });
  const genUrl = useMutation(api.inspections.generateUploadUrl);
  const setPhoto = useMutation(api.inspections.setPhoto);
  const updateChecks = useMutation(api.inspections.updateChecks);
  const sign = useMutation(api.inspections.sign);
  const assignInstaller = useMutation(api.inspections.assignInstaller);

  const [sig, setSig] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [team, setTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!report) return <p className="text-sm text-[var(--color-muted-fg)]">{t("loading")}</p>;

  async function upload(key: string, file: File) {
    setErr("");
    try {
      const url = await genUrl({ tenantId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      await setPhoto({ reportId, photoKey: key, storageId });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("uploadFailed"));
    }
  }

  async function doSign() {
    if (!sig) return setErr(t("signatureMissing"));
    if (!signer.trim()) return setErr(t("signerNameMissing"));
    setBusy(true);
    setErr("");
    try {
      await sign({ reportId, signatureDataUrl: sig, signedByName: signer.trim() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("signError"));
    } finally {
      setBusy(false);
    }
  }

  const allPhotos = report.photos.every((p) => p.url);
  const locked = report.status === "signed";

  const installerUrl =
    typeof window !== "undefined" && report.installerToken
      ? `${window.location.origin}/i/${report.installerToken}`
      : "";

  return (
    <div className="space-y-5 rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {report.customerName} — {report.status === "signed" ? t("signed") : t("draft")}
        </h2>
      </div>

      {!locked && (
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-fg)]">
            {t("installerApp")}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder={report.installerTeam ?? t("teamPlaceholder")}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => assignInstaller({ reportId, installerTeam: team || undefined })}
              className="rounded border border-[var(--color-border)] px-2 py-1.5 text-xs"
            >
              {t("assign")}
            </button>
            {installerUrl && (
              <>
                <code className="rounded bg-[var(--color-muted)] px-2 py-1 text-[11px]">
                  {installerUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard?.writeText(installerUrl)}
                  className="rounded border border-[var(--color-border)] px-2 py-1.5 text-xs"
                >
                  {t("copyLink")}
                </button>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted-fg)]">
            {t("installerInstruction")}
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-fg)]">
          {t("mandatoryPhotos")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {report.photos.map((p) => (
            <div key={p.key} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="text-sm font-medium">{p.label}</div>
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.label} className="mt-2 h-32 w-full rounded object-cover" />
              ) : (
                <div className="mt-2 grid h-32 place-items-center rounded border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted-fg)]">
                  {t("noPhoto")}
                </div>
              )}
              {!locked && (
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(p.key, f);
                  }}
                  className="mt-2 w-full text-xs"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-fg)]">
          {t("functionalTest")}
        </h3>
        <div className="space-y-1.5">
          {report.checks.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.passed}
                disabled={locked}
                onChange={(e) =>
                  updateChecks({
                    reportId,
                    checks: [{ key: c.key, passed: e.target.checked }],
                  })
                }
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {!locked ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-[var(--color-muted-fg)]">
            {t("clientSignature")}
          </h3>
          {!allPhotos && (
            <p className="text-xs text-amber-600">
              {t("uploadAllPhotosFirst")}
            </p>
          )}
          <input
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder={t("signerPlaceholder")}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <SignaturePad onChange={setSig} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            onClick={doSign}
            disabled={busy || !allPhotos}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
          >
            {busy ? "…" : t("generateReport")}
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {t("reportSignedBy", { name: report.signedByName ?? "", date: report.signedAt ? new Date(report.signedAt).toLocaleString() : new Date().toLocaleString() })}
        </div>
      )}
    </div>
  );
}

export default function InspectionsPage() {
  const t = useTranslations("inspections");
  const tenant = useQuery(api.tenants.getMyTenant);
  const template = useQuery(
    api.inspections.getTemplate,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const reports = useQuery(
    api.inspections.list,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const create = useMutation(api.inspections.create);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selected, setSelected] = useState<ReportId | null>(null);
  const [err, setErr] = useState("");

  const [sync, setSync] = useState<SyncState>({
    isOnline: true,
    pendingCount: 0,
    lastSync: null,
    error: null,
  });

  const createReport = useMutation(api.inspections.create);

  const runSync = useCallback(() => {
    void flushQueue({
      "inspection.create": (payload) =>
        createReport(payload as Parameters<typeof createReport>[0]),
    });
  }, [createReport]);

  useEffect(() => {
    const unsub = subscribeSyncState(setSync);
    runSync();
    return unsub;
  }, [runSync]);

  useEffect(() => {
    if (sync.isOnline && sync.pendingCount > 0) runSync();
  }, [sync.isOnline, sync.pendingCount, runSync]);

  async function add() {
    if (!tenant || !name.trim()) {
      setErr(t("clientNameRequired"));
      return;
    }
    setErr("");
    try {
      if (!navigator.onLine) {
        await enqueue("inspection.create", {
          tenantId: tenant._id,
          customerName: name.trim(),
          siteAddress: address.trim() || undefined,
        });
      } else {
        await create({ tenantId: tenant._id, customerName: name.trim(), siteAddress: address.trim() || undefined });
      }
      setName("");
      setAddress("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("createReportError"));
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-[var(--color-muted-fg)]">
            {template
              ? `${template.title} — ${template.legalBasis}`
              : t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncBadge state={sync} onSync={runSync} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] p-4">
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("client")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("siteAddress")}</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <button
          onClick={add}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]"
        >
          {t("newReport")}
        </button>
        {err && <p className="w-full text-sm text-red-600">{err}</p>}
      </div>

      {selected && tenant && <ReportEditor reportId={selected} tenantId={tenant._id} />}

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-fg)]">
            <tr>
              <th className="px-4 py-2 text-left">{t("client")}</th>
              <th className="px-4 py-2 text-left">{t("site")}</th>
              <th className="px-4 py-2 text-center">{t("status")}</th>
              <th className="px-4 py-2 text-right">{t("date")}</th>
              <th className="px-4 py-2 text-center">{t("maps")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {reports?.map((r) => (
              <tr key={r._id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-medium">{r.customerName}</td>
                <td className="px-4 py-3">{r.siteAddress ?? "—"}</td>
                <td className="px-4 py-3 text-center">{r.status}</td>
                <td className="px-4 py-3 text-right text-[var(--color-muted-fg)]">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-center">
                  {(r.siteAddress) && (
                    <div className="flex justify-center gap-1">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.siteAddress || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
                        title={t("openMaps")}
                        aria-label={t("openMaps")}
                      >
                        Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?navigate=yes&address=${encodeURIComponent(r.siteAddress || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#4BB543] px-2 py-1 text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
                        title={t("openWaze")}
                        aria-label={t("openWaze")}
                      >
                        Waze
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setSelected(r._id)}
                      className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      {t("open")}
                    </button>
                    <Link
                      href={`/app/inspections/${r._id}/print`}
                      className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      {t("print")}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {reports && reports.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                  {t("noReports")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
