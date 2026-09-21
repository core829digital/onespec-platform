"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { buildDpa } from "@/shared/dpa";
import { DpaText } from "@/components/dpa/dpa-text";
import { DpaAcceptForm } from "@/components/dpa/dpa-accept";
import { useDpaPdfDownload } from "@/components/dpa/use-dpa-pdf";

type DpaState = FunctionReturnType<typeof api.dpa.getDpaState>;

function DpaBody({ tenant, state }: { tenant: Doc<"tenants">; state: DpaState }) {
  const t = useTranslations("dpa");
  const locale = useLocale();
  const controller = useMemo(
    () => ({ ...state.controller, representative: state.acceptance?.signerName }),
    [state.controller, state.acceptance],
  );
  const doc = useMemo(() => buildDpa(controller), [controller]);
  const { download, busy, ready } = useDpaPdfDownload(state.version, controller, state.acceptance);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">{t("intro")}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("versionLabel", { version: state.version })}</p>
      </div>

      {state.acceptance ? (
        <div className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] p-4 text-sm">
          <p className="font-semibold text-[var(--color-mint)]">{t("acceptedTitle")}</p>
          <p className="mt-1 text-[var(--color-text)]">
            {t("acceptedBy", {
              name: state.acceptance.signerName,
              role: state.acceptance.signerRole,
              date: new Date(state.acceptance.acceptedAt).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" }),
            })}
          </p>
        </div>
      ) : state.canAccept ? (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <h2 className="mb-3 font-semibold text-[var(--color-text)]">{t("acceptTitle")}</h2>
          <DpaAcceptForm
            tenantId={tenant._id}
            version={state.version}
            companyName={tenant.name}
            controllerComplete={state.controllerComplete}
          />
        </section>
      ) : (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm text-[var(--color-text-secondary)]">
          {t("ownerMustAccept")}
        </p>
      )}

      <button
        type="button"
        onClick={() => void download()}
        disabled={!ready || busy}
        className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:opacity-50"
      >
        {busy ? t("downloading") : state.acceptance ? t("downloadSigned") : t("downloadPreview")}
      </button>

      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
        <DpaText doc={doc} />
      </div>
    </div>
  );
}

export default function DpaPage() {
  const t = useTranslations("dpa");
  const tenant = useQuery(api.tenants.getMyTenant);
  const state = useQuery(api.dpa.getDpaState, tenant ? { tenantId: tenant._id } : "skip");
  if (!tenant || state === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  return <DpaBody tenant={tenant} state={state} />;
}
