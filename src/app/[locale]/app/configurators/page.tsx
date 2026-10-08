"use client";

import { useState } from "react";
import { analytics as posthog } from "@/lib/monitoring";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { ExternalLink } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTranslations } from "next-intl";
import { requestConfirm } from "@/lib/confirm-dialog";
import { OPEN_BUTTON_CLASS } from "@/components/ui/open-button";

const STATUS_KEY: Record<string, "statusDraft" | "statusPublished" | "statusArchived"> = {
  draft: "statusDraft",
  published: "statusPublished",
  archived: "statusArchived",
};

export default function ConfiguratorsPage() {
  const t = useTranslations("configurators");
  const tf = useFriendlyError();
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(
    api.configurators.listConfigurators,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const createConfigurator = useMutation(api.configurators.createConfigurator);
  const publishConfigurator = useMutation(api.configurators.publishConfigurator);
  const deleteConfigurator = useMutation(api.configurators.deleteConfigurator);
  const archiveConfigurator = useMutation(api.configurators.archiveConfigurator);
  const restoreConfigurator = useMutation(api.configurators.restoreConfigurator);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);

  async function handlePublish(configuratorId: string) {
    setError("");
    setPublishingId(configuratorId);
    try {
      await publishConfigurator({ configuratorId: configuratorId as Id<"configurators"> });
      posthog.capture("configurator_published", {
        configurator_id: configuratorId,
        source: "configurator_list",
      });
    } catch (err) {
      posthog.captureException(err);
      setError(tf(err));
    } finally {
      setPublishingId(null);
    }
  }

  async function handleArchive(c: { _id: string; name: string }) {
    setError("");
    if (!(await requestConfirm(t("archiveConfirm", { name: c.name }), { confirmLabel: t("archive") }))) return;
    setArchivingId(c._id);
    try {
      await archiveConfigurator({ configuratorId: c._id as Id<"configurators"> });
      posthog.capture("configurator_archived", { configurator_id: c._id });
    } catch (err) {
      posthog.captureException(err);
      setError(tf(err));
    } finally {
      setArchivingId(null);
    }
  }

  async function handleRestore(c: { _id: string }) {
    setError("");
    setArchivingId(c._id);
    try {
      await restoreConfigurator({ configuratorId: c._id as Id<"configurators"> });
      posthog.capture("configurator_restored", { configurator_id: c._id });
    } catch (err) {
      posthog.captureException(err);
      setError(tf(err));
    } finally {
      setArchivingId(null);
    }
  }

  async function handleDelete(c: { _id: string; name: string; status: string }) {
    setError("");
    const message = c.status === "published" ? t("deleteConfirmPublished", { name: c.name }) : t("deleteConfirm", { name: c.name });
    if (!(await requestConfirm(message, { danger: true, confirmLabel: t("delete") }))) return;
    setDeletingId(c._id);
    try {
      await deleteConfigurator({ configuratorId: c._id as Id<"configurators"> });
      posthog.capture("configurator_deleted", { configurator_id: c._id });
    } catch (err) {
      posthog.captureException(err);
      setError(tf(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate() {
    if (!tenant || creating) return;
    setCreating(true);
    setError("");
    try {
      // No name prompt here on purpose: naming used to be a form the person
      // had to fill in BEFORE anything existed, on this bare list page — now
      // it's just the first thing they see once inside the guided wizard
      // (setup's "general" step, GeneralTab's very first field), the same
      // place every other setting lives. A placeholder default name means
      // there's nothing blocking them from clicking straight into the
      // wizard, which is the actual point: teach the full step-by-step flow,
      // not front-load one field of it.
      // Bug fix (2026-09-29): createConfigurator returns
      // `{ configuratorId, publicId }`, not the id itself — the previous
      // code assigned the whole object to `configuratorId` and interpolated
      // it into the URL, producing the literal route
      // /app/configurators/[object Object]/setup. Convex then rejected
      // "[object Object]" as an invalid document id, which is exactly the
      // "getEditorState Server Error" reported right after creating a new
      // configurator. Destructure the real id instead.
      const { configuratorId } = await createConfigurator({
        tenantId: tenant._id,
        name: t("defaultName"),
      });
      posthog.capture("configurator_created", {
        configurator_id: String(configuratorId),
        source: "configurator_list",
      });
      router.push(`/app/configurators/${configuratorId}/setup`);
    } catch (err) {
      posthog.captureException(err);
      setError(tf(err));
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? t("creating") : t("create")}
        </button>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("createHint")}</p>
      </div>
      {error && <p className="text-[var(--color-danger)] text-sm">{error}</p>}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        {configurators === undefined ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
            {t("loading")}
          </div>
        ) : configurators.length === 0 ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
            {t("empty")}
          </div>
        ) : (
          configurators.map((c) => (
            <div
              key={c._id}
              className="px-6 py-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  <span>{c.status in STATUS_KEY ? t(STATUS_KEY[c.status]) : c.status}</span> · /w/
                  {c.publicId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => handlePublish(c._id)}
                    disabled={publishingId === c._id}
                    className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {publishingId === c._id ? t("publishing") : t("publish")}
                  </button>
                )}
                {c.status === "published" && (
                  <a
                    href={`/c/${c.publicId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={OPEN_BUTTON_CLASS}
                  >
                    {t("open")}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
                <Link
                  href={`/app/configurators/${c._id}`}
                  className="text-[var(--color-mint-text)] text-sm hover:underline"
                >
                  {t("edit")}
                </Link>
                {c.status === "archived" ? (
                  <button
                    type="button"
                    onClick={() => void handleRestore(c)}
                    disabled={archivingId === c._id}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:border-[var(--color-mint)] disabled:opacity-50"
                  >
                    {archivingId === c._id ? t("restoring") : t("restore")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleArchive(c)}
                    disabled={archivingId === c._id}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:border-[var(--color-mint)] disabled:opacity-50"
                  >
                    {archivingId === c._id ? t("archiving") : t("archive")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDelete(c)}
                  disabled={deletingId === c._id}
                  className="rounded-lg border border-[var(--color-danger)]/50 px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
                >
                  {deletingId === c._id ? t("deleting") : t("delete")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}