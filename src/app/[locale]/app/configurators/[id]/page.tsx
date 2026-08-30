"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";

export default function ConfiguratorEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const state = useQuery(api.configurators.getEditorState, {
    configuratorId: id as Id<"configurators">,
  });

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

  const embedUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/w/${state.configurator.publicId}`
      : `/w/${state.configurator.publicId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/configurators" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ←
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{state.configurator.name}</h1>
        <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-alt)] border border-[var(--color-border)] text-xs capitalize">
          {state.configurator.status}
        </span>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-1">Codice embed</p>
          <pre className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 overflow-x-auto">
            {`<iframe src="${embedUrl}" width="100%" height="640" frameborder="0"></iframe>`}
          </pre>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-1">Anteprima</p>
          <iframe
            src={`/w/${state.configurator.publicId}?preview=1`}
            className="w-full h-[500px] rounded border border-[var(--color-border)] bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-[var(--color-text-secondary)]">Materiali</p>
          <p className="text-2xl font-bold">{state.materials.length}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-[var(--color-text-secondary)]">Opzioni hardware</p>
          <p className="text-2xl font-bold">{state.hardware.length}</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">
        L&apos;editor completo del catalogo e del branding è in arrivo.
      </p>
    </div>
  );
}
