"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { GeneralTab } from "@/components/configurator/general-tab";
import { CatalogTab } from "@/components/configurator/catalog-tab";
import { BrandingTab } from "@/components/configurator/branding-tab";
import { EmbedTab } from "@/components/configurator/embed-tab";
import { ConfigTab } from "@/components/configurator/config-tab";
import { cn } from "@/lib/utils";

type Tab = "general" | "catalog" | "branding" | "embed" | "config" | "versions";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "general", label: "Generale" },
  { id: "catalog", label: "Catalogo e prezzi" },
  { id: "branding", label: "Branding" },
  { id: "embed", label: "Incorpora" },
  { id: "config", label: "Config. effettiva" },
  { id: "versions", label: "Versioni" },
];

export default function ConfiguratorEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const configuratorId = id as Id<"configurators">;
  const state = useQuery(api.configurators.getEditorState, { configuratorId });
  const [tab, setTab] = useState<Tab>("general");
  const [previewNonce, setPreviewNonce] = useState(0);

  if (state === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }
  if (state === null) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--color-text-secondary)]">Configuratore non trovato.</p>
        <Link href="/app/configurators" className="text-[var(--color-mint)] hover:underline">
          ← Torna ai configuratori
        </Link>
      </div>
    );
  }

  const cfg = state.configurator;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/app/configurators"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          aria-label="Torna ai configuratori"
        >
          ←
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{cfg.name}</h1>
        <StatusBadge status={cfg.status} kind="configurator" />
        <span className="text-xs text-[var(--color-text-secondary)]">
          /w/{cfg.publicId}
          {cfg.publishedCatalogVersion ? ` · v${cfg.publishedCatalogVersion}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/w/${cfg.publicId}?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)]"
          >
            Anteprima
          </a>
          <PublishButton configuratorId={configuratorId} onPublished={() => setPreviewNonce((n) => n + 1)} />
        </div>
      </div>

      <div className="border-b border-[var(--color-border)] flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-[var(--color-mint)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
        <div>
          {tab === "general" && <GeneralTab configuratorId={configuratorId} configurator={cfg} />}
          {tab === "catalog" && <CatalogTab configuratorId={configuratorId} state={state} />}
          {tab === "branding" && <BrandingTab configuratorId={configuratorId} />}
          {tab === "embed" && (
            <EmbedTab publicId={cfg.publicId} status={cfg.status} origin={origin} />
          )}
          {tab === "config" && <ConfigTab configuratorId={configuratorId} />}
          {tab === "versions" && <VersionsTab configuratorId={configuratorId} />}
        </div>

        <aside className="hidden xl:block sticky top-4">
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-alt)]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Anteprima (bozza)
              </span>
              <button
                type="button"
                onClick={() => setPreviewNonce((n) => n + 1)}
                className="text-xs text-[var(--color-mint)] hover:underline"
              >
                Ricarica
              </button>
            </div>
            <iframe
              key={previewNonce}
              src={`/w/${cfg.publicId}?preview=1`}
              title="Anteprima configuratore"
              className="w-full h-[640px] bg-white"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PublishButton({
  configuratorId,
  onPublished,
}: {
  configuratorId: Id<"configurators">;
  onPublished: () => void;
}) {
  const publish = useMutation(api.configurators.publishConfigurator);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true);
    setErr("");
    try {
      await publish({ configuratorId, changeNote: note.trim() || undefined });
      setOpen(false);
      setNote("");
      onPublished();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore nella pubblicazione");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg bg-[var(--color-mint)] px-4 py-1.5 text-sm font-semibold text-[var(--color-mint-dark)]"
      >
        Pubblica
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-2 z-10 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3 shadow-lg space-y-2">
      <p className="text-sm font-medium text-[var(--color-text)]">Pubblica versione</p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Crea una nuova versione del catalogo e la rende attiva sul widget pubblico.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota di modifica (opzionale)"
        maxLength={280}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        rows={2}
      />
      {err ? <p className="text-xs text-[var(--color-danger)]">{err}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className="flex-1 rounded-lg bg-[var(--color-mint)] px-3 py-1.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
        >
          {busy ? "..." : "Conferma"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
        >
          Annulla
        </button>
      </div>
        </div>
      ) : null}
    </div>
  );
}

function VersionsTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
  const versions = useQuery(api.configurators.listVersions, { configuratorId });
  const rollback = useMutation(api.configurators.rollbackToVersion);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  if (versions === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }
  if (versions.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Nessuna versione pubblicata. Usa &quot;Pubblica&quot; per creare la prima.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {versions.map((v) => (
          <div key={v._id} className="flex items-center gap-3 px-4 py-3">
            <span className="font-mono text-sm text-[var(--color-text)]">v{v.version}</span>
            {v.isCurrent ? (
              <span className="rounded-full bg-[var(--color-mint-light)] border border-[var(--color-mint)]/40 px-2 py-0.5 text-xs text-[var(--color-mint)]">
                Attiva
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--color-text-secondary)] truncate">
                {new Date(v.publishedAt).toLocaleString("it-IT")}
                {v.changeNote ? ` · ${v.changeNote}` : ""}
              </p>
            </div>
            {!v.isCurrent ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(v.version);
                  setErr("");
                  try {
                    await rollback({ configuratorId, version: v.version });
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Errore nel ripristino");
                  } finally {
                    setBusy(null);
                  }
                }}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text)]"
              >
                {busy === v.version ? "..." : "Ripristina"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
