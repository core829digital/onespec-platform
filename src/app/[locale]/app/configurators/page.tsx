"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTranslations } from "next-intl";

const STATUS_KEY: Record<string, "statusDraft" | "statusPublished" | "statusArchived"> = {
  draft: "statusDraft",
  published: "statusPublished",
  archived: "statusArchived",
};

export default function ConfiguratorsPage() {
  const t = useTranslations("configurators");
  const tf = useFriendlyError();
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(
    api.configurators.listConfigurators,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const createConfigurator = useMutation(api.configurators.createConfigurator);
  const publishConfigurator = useMutation(api.configurators.publishConfigurator);
  const [name, setName] = useState("");
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const configuratorId = await createConfigurator({ tenantId: tenant._id, name: name.trim() });
      posthog.capture("configurator_created", {
        configurator_id: String(configuratorId),
        source: "configurator_list",
      });
      setName("");
    } catch (err) {
      posthog.captureException(err);
      setError(tf(err));
    } finally {
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

      <form onSubmit={handleCreate} className="flex gap-2 max-w-md">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("newNamePlaceholder")}
          disabled={creating}
        />
        <Button type="submit" disabled={creating || !name.trim()}>
          {creating ? t("creating") : t("create")}
        </Button>
      </form>
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
                <Link
                  href={`/app/configurators/${c._id}`}
                  className="text-[var(--color-mint)] text-sm hover:underline"
                >
                  {t("edit")}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}