"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface PickerConfigurator {
  _id: string;
  name: string;
  status: string;
  publishedCatalogVersion?: number;
}

/** A configurator the Showroom can price with: published, with a catalogue version. */
export const isShowroomReady = (c: PickerConfigurator) => c.status === "published" && c.publishedCatalogVersion !== undefined;

/**
 * The configurator to ask the server for: the first candidate (just picked, remembered by this browser) that is
 * still a published configurator of the tenant; none means "let the server choose" (its latest published one).
 */
export function resolveChoice(configurators: PickerConfigurator[], ...candidates: Array<string | null | undefined>): string | undefined {
  const ready = configurators.filter(isShowroomReady);
  return candidates.find((id): id is string => !!id && ready.some((c) => c._id === id));
}

/**
 * The configurator whose catalogue the Showroom uses. Drafts are listed but cannot be chosen: only a published
 * configurator has a catalogue to price with.
 */
export function ConfiguratorPicker({
  configurators,
  value,
  onChange,
}: {
  configurators: PickerConfigurator[];
  /** The configurator in use (what the catalogue actually came from). */
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("showroom");
  if (configurators.length === 0) return null;
  const ready = configurators.filter(isShowroomReady);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] p-3">
      <label className="block min-w-[220px] flex-1 text-sm" htmlFor="showroom-configurator">
        <span className="text-[var(--color-muted-fg)]">{t("configurator")}</span>
        <select
          id="showroom-configurator"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          {value === undefined ? <option value="" disabled>{t("configuratorChoose")}</option> : null}
          {configurators.map((c) => (
            <option key={c._id} value={c._id} disabled={!isShowroomReady(c)}>
              {c.name}
              {isShowroomReady(c) ? "" : ` · ${c.status === "archived" ? t("configuratorArchived") : t("configuratorDraft")}`}
            </option>
          ))}
        </select>
      </label>
      <Link href="/app/configurators" className="pb-2 text-sm text-[var(--color-mint-text)] hover:underline">
        {t("configuratorManage")}
      </Link>
      {ready.length === 0 ? (
        <p className="basis-full text-xs text-[var(--color-muted-fg)]">{t("configuratorNonePublished")}</p>
      ) : (
        <p className="basis-full text-xs text-[var(--color-muted-fg)]">{t("configuratorHelp")}</p>
      )}
    </div>
  );
}
