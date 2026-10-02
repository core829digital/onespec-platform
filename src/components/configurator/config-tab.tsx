"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Section } from "./editor-primitives";
import { planDisplayName } from "@/lib/plan-gates";

const LAYER_TONE: Record<string, string> = {
  platform: "text-[var(--color-text-secondary)]",
  plan: "text-sky-500",
  region: "text-violet-500",
  tenant: "text-amber-500",
  configurator: "text-[var(--color-mint-text)]",
  widget: "text-pink-500",
};

export function ConfigTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
  const t = useTranslations("editor.config");
  const data = useQuery(api.configurators.getEffectiveConfig, { configuratorId });

  // Known keys are translated; an unknown one (newer backend) shows as-is.
  const label = (prefix: "layer" | "field", key: string) =>
    t.has(`${prefix}_${key}`) ? t(`${prefix}_${key}`) : key;
  const fmt = (v: unknown): string => {
    if (v === true) return t("yes");
    if (v === false) return t("no");
    if (v === Infinity) return t("unlimited");
    return String(v);
  };

  if (data === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (data === null) return <p className="text-[var(--color-danger)]">{t("unavailable")}</p>;

  const entries = Object.entries(data.effective) as Array<[string, { value: unknown; source: string }]>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {t("intro", {
          layers: data.layers.map((l) => label("layer", l)).join(" → "),
          plan: planDisplayName(data.plan),
        })}
      </p>

      <Section title={t("effectiveTitle")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]" aria-label={t("effectiveTitle")}>
            <thead>
              <tr>
                <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("colSetting")}</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("colValue")}</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("colSource")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {entries.map(([key, resolved]) => (
                <tr key={key}>
                  <td className="px-3 py-2 text-[var(--color-text)]">{label("field", key)}</td>
                  <td className="px-3 py-2 text-[var(--color-text)] font-mono tabular-nums">{fmt(resolved.value)}</td>
                  <td className={`px-3 py-2 ${LAYER_TONE[resolved.source] ?? ""}`}>{label("layer", resolved.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t("defaultsTitle")} description={t("defaultsDesc")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]" aria-label={t("defaultsTitle")}>
            <tbody className="divide-y divide-[var(--color-border)]">
              {Object.entries(data.platformDefaults).map(([k, v]) => (
                <tr key={k}>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{label("field", k)}</td>
                  <td className="px-3 py-2 text-[var(--color-text)] font-mono">{fmt(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
