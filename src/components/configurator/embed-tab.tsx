"use client";

import { useState } from "react";
import { Section } from "./editor-primitives";

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto text-[var(--color-text)]">
        {code}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="absolute top-2 right-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-2 py-1 text-xs text-[var(--color-text-secondary)]"
      >
        {copied ? "Copiato" : "Copia"}
      </button>
    </div>
  );
}

export function EmbedTab({
  publicId,
  status,
  origin,
}: {
  publicId: string;
  status: string;
  origin: string;
}) {
  const src = `${origin}/w/${publicId}`;
  const iframe = `<iframe
  src="${src}"
  title="Configuratore preventivo"
  style="width:100%;border:0;min-height:640px"
  loading="lazy"
></iframe>`;

  const resize = `<script>
  window.addEventListener("message", function (e) {
    if (e.origin !== "${origin}") return;
    var d = e.data || {};
    if (d.type === "onespec:resize" && d.publicId === "${publicId}") {
      var f = document.querySelector('iframe[src^="${src}"]');
      if (f && typeof d.height === "number") f.style.height = d.height + "px";
    }
  });
</script>`;

  return (
    <div className="space-y-6">
      {status !== "published" ? (
        <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Questo configuratore non è ancora pubblicato. Il widget incorporato mostrerà un errore
          finché non pubblichi dalla barra in alto.
        </p>
      ) : null}

      <Section title="Codice di incorporamento" description="Incolla questo snippet nella pagina del tuo sito dove vuoi mostrare il configuratore.">
        <CopyBlock code={iframe} />
      </Section>

      <Section
        title="Ridimensionamento automatico (opzionale)"
        description="Aggiungi questo script alla stessa pagina per adattare l'altezza dell'iframe al contenuto. Vengono accettati solo messaggi dall'origine di OneSpec."
      >
        <CopyBlock code={resize} />
      </Section>

      <Section title="Anteprima diretta" description="Link privato con i dati in bozza (non richiede pubblicazione).">
        <CopyBlock code={`${origin}/w/${publicId}?preview=1`} />
      </Section>
    </div>
  );
}
