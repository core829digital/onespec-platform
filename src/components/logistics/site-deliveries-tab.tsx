"use client";

import { ConvexError } from "convex/values";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations, useFormatter } from "next-intl";
import { requestConfirm } from "@/lib/confirm-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignaturePad } from "@/components/signature-pad";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Plus, Trash2, FileText, Camera, X, Truck } from "lucide-react";

const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB — short packaging clips, not full-length video.
const MEDIA_MAX = 4;

const STATUS_TONE: Record<string, string> = {
  preparing: "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]",
  in_transit: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
};

interface ItemDraft {
  label: string;
  quantity: string;
  unit: string;
}

export function SiteDeliveriesTab({ tenantId, onError }: { tenantId: Id<"tenants">; onError: (e: unknown) => void }) {
  const t = useTranslations("logistics.siteDeliveries");
  const format = useFormatter();

  const cantieri = useQuery(api.cantieri.listCantieri, { tenantId, limit: 200 });
  const [selectedId, setSelectedId] = useState<Id<"siteDeliveries"> | null>(null);
  const deliveries = useQuery(api.siteDeliveries.listSiteDeliveries, { tenantId, limit: 100 });

  const [creating, setCreating] = useState(false);
  const [newCantiereId, setNewCantiereId] = useState<string>("");
  const [itemDrafts, setItemDrafts] = useState<ItemDraft[]>([{ label: "", quantity: "1", unit: "pz" }]);
  const [savingCreate, setSavingCreate] = useState(false);

  const createSiteDelivery = useMutation(api.siteDeliveries.createSiteDelivery);

  const cantiereName = (id: string) => cantieri?.find((c) => c._id === id)?.name ?? "—";

  async function submitCreate() {
    const validItems = itemDrafts
      .map((d) => ({ label: d.label.trim(), quantity: Number(d.quantity), unit: d.unit.trim() || "pz" }))
      .filter((d) => d.label && Number.isFinite(d.quantity) && d.quantity > 0);
    if (!newCantiereId || validItems.length === 0) return;
    setSavingCreate(true);
    try {
      const id = await createSiteDelivery({
        tenantId,
        cantiereId: newCantiereId as Id<"cantieri">,
        items: validItems,
      });
      setCreating(false);
      setNewCantiereId("");
      setItemDrafts([{ label: "", quantity: "1", unit: "pz" }]);
      setSelectedId(id);
    } catch (e) {
      onError(e);
    } finally {
      setSavingCreate(false);
    }
  }

  if (selectedId) {
    return (
      <SiteDeliveryDetail
        siteDeliveryId={selectedId}
        onBack={() => setSelectedId(null)}
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-3 py-2 text-sm font-semibold text-[var(--color-mint-dark)] hover:opacity-90"
        >
          <Plus size={16} aria-hidden="true" />
          {t("new")}
        </button>
      </div>

      {creating ? (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{t("cantiere")}</label>
            <select
              value={newCantiereId}
              onChange={(e) => setNewCantiereId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">{t("selectCantiere")}</option>
              {cantieri?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">{t("itemsToLoad")}</label>
            {itemDrafts.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={d.label}
                  onChange={(e) => {
                    const next = itemDrafts.slice();
                    next[i] = { ...next[i], label: e.target.value };
                    setItemDrafts(next);
                  }}
                  placeholder={t("itemLabelPlaceholder")}
                  maxLength={200}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
                <input
                  type="number"
                  min={1}
                  value={d.quantity}
                  onChange={(e) => {
                    const next = itemDrafts.slice();
                    next[i] = { ...next[i], quantity: e.target.value };
                    setItemDrafts(next);
                  }}
                  className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-sm text-[var(--color-text)] font-mono"
                />
                <input
                  value={d.unit}
                  onChange={(e) => {
                    const next = itemDrafts.slice();
                    next[i] = { ...next[i], unit: e.target.value };
                    setItemDrafts(next);
                  }}
                  maxLength={20}
                  className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-sm text-[var(--color-text)]"
                />
                {itemDrafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setItemDrafts(itemDrafts.filter((_, x) => x !== i))}
                    className="rounded-lg border border-[var(--color-border)] px-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                    aria-label={t("removeItem")}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItemDrafts([...itemDrafts, { label: "", quantity: "1", unit: "pz" }])}
              className="text-xs text-[var(--color-mint-text)] hover:underline"
            >
              + {t("addItem")}
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={savingCreate || !newCantiereId}
              onClick={submitCreate}
              className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
            >
              {savingCreate ? t("creating") : t("create")}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {deliveries === undefined ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
      ) : deliveries.length === 0 ? (
        <EmptyState title={t("empty")} hint={t("emptyHint")} />
      ) : (
        <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          {deliveries.map((d) => (
            <button
              key={d._id}
              type="button"
              onClick={() => setSelectedId(d._id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg)]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--color-text)]">{cantiereName(d.cantiereId)}</p>
                <p className="truncate text-xs text-[var(--color-text-secondary)]">
                  {d.items.length} {t("itemsCount")} ·{" "}
                  {d.scheduledDate ? format.dateTime(new Date(d.scheduledDate), { dateStyle: "medium" }) : t("noDate")}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[d.status]}`}>
                {t(`status.${d.status}`)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SiteDeliveryDetail({
  siteDeliveryId,
  onBack,
  onError,
}: {
  siteDeliveryId: Id<"siteDeliveries">;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const t = useTranslations("logistics.siteDeliveries");
  const format = useFormatter();
  const row = useQuery(api.siteDeliveries.getSiteDelivery, { siteDeliveryId });
  const setChecklistItem = useMutation(api.siteDeliveries.setChecklistItem);
  const generateUploadUrl = useMutation(api.siteDeliveries.generateUploadUrl);
  const addPackagingMedia = useMutation(api.siteDeliveries.addPackagingMedia);
  const removePackagingMedia = useMutation(api.siteDeliveries.removePackagingMedia);
  const signSiteDelivery = useMutation(api.siteDeliveries.signSiteDelivery);
  const markDelivered = useMutation(api.siteDeliveries.markSiteDeliveryDelivered);
  const cancelSiteDelivery = useMutation(api.siteDeliveries.cancelSiteDelivery);

  const [signerName, setSignerName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  if (row === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (row === null) return <p className="text-sm text-[var(--color-danger)]">{t("notFound")}</p>;

  const editable = row.status === "preparing";
  const allResolved = row.items.every((i) => i.loaded || i.notLoadedReason);

  async function toggleItem(index: number, loaded: boolean) {
    try {
      await setChecklistItem({ siteDeliveryId, itemIndex: index, loaded, notLoadedReason: reasonDrafts[index] });
    } catch (e) {
      onError(e);
    }
  }

  async function saveReason(index: number) {
    try {
      await setChecklistItem({
        siteDeliveryId,
        itemIndex: index,
        loaded: false,
        notLoadedReason: reasonDrafts[index] ?? "",
      });
    } catch (e) {
      onError(e);
    }
  }

  async function uploadMedia(file: File) {
    if (!MEDIA_TYPES.includes(file.type)) return onError(new Error("UNSUPPORTED_MEDIA_TYPE"));
    if (file.size > MAX_MEDIA_BYTES) return onError(new Error("FILE_TOO_LARGE"));
    setUploading(true);
    try {
      const { uploadUrl } = await generateUploadUrl({ siteDeliveryId, contentType: file.type });
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new ConvexError("UPLOAD_FAILED");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await addPackagingMedia({ siteDeliveryId, storageId });
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
    }
  }

  async function handleSign() {
    if (!signatureDataUrl || !signerName.trim()) return;
    setBusy(true);
    try {
      await signSiteDelivery({ siteDeliveryId, signedByName: signerName.trim(), signatureDataUrl });
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeliver() {
    setBusy(true);
    try {
      await markDelivered({ siteDeliveryId });
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!(await requestConfirm(t("confirmCancel"), { danger: true }))) return;
    setBusy(true);
    try {
      await cancelSiteDelivery({ siteDeliveryId });
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-[var(--color-mint-text)] hover:underline">
        ← {t("backToList")}
      </button>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-[var(--color-text)]">{row.cantiere?.name ?? "—"}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {row.cantiere?.address}, {row.cantiere?.city}
              {row.client ? ` · ${row.client.name}` : ""}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[row.status]}`}>
            {t(`status.${row.status}`)}
          </span>
        </div>

        {row.status === "delivered" ? (
          <a
            href={`/app/logistics/site-deliveries/${siteDeliveryId}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          >
            <FileText size={14} aria-hidden="true" />
            {t("viewReport")}
          </a>
        ) : null}
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("checklistTitle")}</h3>
        <ul className="space-y-2">
          {row.items.map((item, i) => (
            <li key={i} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex flex-1 items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={item.loaded}
                    disabled={!editable}
                    onChange={(e) => toggleItem(i, e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-mint)]"
                  />
                  <span className={item.loaded ? "text-[var(--color-text)]" : "text-[var(--color-text)]"}>
                    {item.label} <span className="text-[var(--color-text-secondary)]">({item.quantity} {item.unit})</span>
                  </span>
                </label>
              </div>
              {!item.loaded && editable ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={reasonDrafts[i] ?? item.notLoadedReason ?? ""}
                    onChange={(e) => setReasonDrafts({ ...reasonDrafts, [i]: e.target.value })}
                    placeholder={t("notLoadedReasonPlaceholder")}
                    maxLength={500}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)]"
                  />
                  <button
                    type="button"
                    onClick={() => saveReason(i)}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                  >
                    {t("saveReason")}
                  </button>
                </div>
              ) : !item.loaded && item.notLoadedReason ? (
                <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                  {t("notLoadedBecause", { reason: item.notLoadedReason })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Packaging media */}
      {editable ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <h3 className="mb-1 text-sm font-semibold text-[var(--color-text)]">{t("mediaTitle")}</h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{t("mediaHint")}</p>
          <div className="flex flex-wrap gap-3">
            {row.mediaUrls.map((url, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-[var(--color-border)]">
                {url.match(/\.(mp4|mov|webm)/i) ? (
                  <video src={url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removePackagingMedia({ siteDeliveryId, storageId: row.packagingMediaIds[i] })}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label={t("removeMedia")}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {row.packagingMediaIds.length < MEDIA_MAX ? (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-mint)]">
                <Camera size={20} aria-hidden="true" />
                <span className="text-[10px]">{uploading ? t("uploading") : t("addMedia")}</span>
                <input
                  type="file"
                  accept={MEDIA_TYPES.join(",")}
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadMedia(file);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : row.mediaUrls.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("mediaTitle")}</h3>
          <div className="flex flex-wrap gap-3">
            {row.mediaUrls.map((url, i) =>
              url.match(/\.(mp4|mov|webm)/i) ? (
                <video key={i} src={url} controls className="h-24 w-24 rounded-lg object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
              ),
            )}
          </div>
        </div>
      ) : null}

      {/* Sign & depart */}
      {editable ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("signTitle")}</h3>
          {!allResolved ? <p className="text-xs text-amber-600 dark:text-amber-400">{t("checklistIncompleteHint")}</p> : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{t("signerName")}</label>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              maxLength={120}
              placeholder={t("signerNamePlaceholder")}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            />
          </div>
          <SignaturePad onChange={setSignatureDataUrl} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !allResolved || !signatureDataUrl || !signerName.trim()}
              onClick={handleSign}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
            >
              <Truck size={16} aria-hidden="true" />
              {t("signAndDepart")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleCancel}
              className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm text-[var(--color-danger)] disabled:opacity-50"
            >
              {t("cancelDelivery")}
            </button>
          </div>
        </div>
      ) : row.status === "in_transit" ? (
        <div className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5 p-4 space-y-2">
          <p className="text-sm text-[var(--color-text)]">
            {t("departedOn", {
              date: row.departedAt ? format.dateTime(new Date(row.departedAt), { dateStyle: "medium", timeStyle: "short" }) : "",
              signer: row.signedByName ?? "",
            })}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleDeliver}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {t("markDelivered")}
          </button>
        </div>
      ) : row.status === "delivered" ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-sm text-[var(--color-text)]">
            {t("deliveredOn", {
              date: row.deliveredAt ? format.dateTime(new Date(row.deliveredAt), { dateStyle: "medium", timeStyle: "short" }) : "",
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
