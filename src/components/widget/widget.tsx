"use client";

interface WidgetProps {
  configurator: any; // Type from widget.getPublicConfigurator
  theme: string;
  lang: string;
  preview: boolean;
}

export function Widget({ configurator, theme, lang, preview }: WidgetProps) {
  return (
    <div className="w-full h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">{configurator.name}</h1>
        <div className="bg-[var(--color-bg-alt)] rounded-lg p-6 border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Widget stub. Full implementation pending.
          </p>
          <p className="mt-2 text-sm">
            Theme: {theme} | Lang: {lang} | Preview: {preview ? "yes" : "no"}
          </p>
          <pre className="mt-4 text-xs bg-[var(--color-bg)] p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(configurator, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
