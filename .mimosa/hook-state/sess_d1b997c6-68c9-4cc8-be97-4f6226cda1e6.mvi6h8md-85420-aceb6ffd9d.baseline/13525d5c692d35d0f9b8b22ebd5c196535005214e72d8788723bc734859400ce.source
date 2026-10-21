"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ACCESSORY_CATEGORY_LABELS, type AccessoryCategory } from "@/shared/configurator-model";
import type { ProjectItem } from "@/shared/pricing";
import { QUALITY_CLASS_LABEL, type QualityClass } from "@/shared/standard-pricing";
import type { catalogChoices } from "./catalog-labels";
import { FinishPicker } from "./finish-picker";
import { GlazingPicker } from "./glazing-picker";

type Choices = ReturnType<typeof catalogChoices>;

const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";
const label = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";

interface Props {
  item: ProjectItem;
  choices: Choices;
  locale: string;
  onPatch: (patch: Partial<ProjectItem>) => void;
  onWidth: (mm: number) => void;
  onHeight: (mm: number) => void;
  onMaterial: (key: string) => void;
}

/** The catalogue-driven selects of one piece: size, material chain, glazing, finish, accessories, notes. */
export function PieceForm({ item, choices, locale, onPatch, onWidth, onHeight, onMaterial }: Props) {
  const t = useTranslations("pieces");
  const groups = Array.from(new Set(choices.profiles.map((p) => p.group).filter(Boolean))) as string[];
  const chosenProfile = choices.profiles.find((p) => p.key === item.profileSystem);
  const groupLabel = (g: string) => {
    if (g === "tab1") return t("groupValue");
    if (g === "tab2") return t("groupPremium");
    const klass = QUALITY_CLASS_LABEL[g as QualityClass];
    return klass ? (klass as Record<string, string>)[locale] ?? klass.it : g;
  };
  const acc = item.accessories ?? {};
  const setAcc = (patch: Partial<NonNullable<ProjectItem["accessories"]>>) => onPatch({ accessories: { ...acc, ...patch } });
  const anyAccessory = (["zanz", "cass", "avv", "pers"] as const).some((c) => acc[c] && acc[c] !== "none");

  // The width/height override inputs below only make sense while the
  // accessories <details> panel is open. Closing it (every category back to
  // "none") can leave a stale out-of-range value behind in the now-hidden
  // inputs; the browser's own constraint validation still tracks it as
  // invalid, and a later form-wide submit that tries to auto-focus it logs
  // "invalid form control ... is not focusable" since it's inside a closed
  // <details>. Clear the overrides on close instead of leaving them dangling.
  useEffect(() => {
    if (!anyAccessory && (acc.width !== undefined || acc.height !== undefined)) {
      setAcc({ width: undefined, height: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyAccessory]);

  const baseId = `piece-form-${item.width}-${item.height}-${item.material}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor={`${baseId}-width`}>{t("width")}</label>
          <input id={`${baseId}-width`} name="width" type="number" inputMode="numeric" step={10} min={200} max={6000} value={item.width} onChange={(e) => onWidth(Number(e.target.value) || 0)} className={`${field} font-mono`} />
        </div>
        <div>
          <label className={label} htmlFor={`${baseId}-height`}>{t("height")}</label>
          <input id={`${baseId}-height`} name="height" type="number" inputMode="numeric" step={10} min={200} max={6000} value={item.height} onChange={(e) => onHeight(Number(e.target.value) || 0)} className={`${field} font-mono`} />
        </div>
        <div>
          <label className={label} htmlFor={`${baseId}-quantity`}>{t("quantity")}</label>
          <input id={`${baseId}-quantity`} name="quantity" type="number" inputMode="numeric" min={1} max={50} value={item.quantity} onChange={(e) => onPatch({ quantity: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} className={`${field} font-mono`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`${baseId}-material`}>{t("material")}</label>
          <select id={`${baseId}-material`} value={item.material} onChange={(e) => onMaterial(e.target.value)} className={field}>
            {choices.materials.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`${baseId}-quality`}>{t("quality")}</label>
          <select id={`${baseId}-quality`} value={item.quality[item.material] ?? ""} onChange={(e) => onPatch({ quality: { ...item.quality, [item.material]: e.target.value } })} className={field}>
            {choices.qualities.map((q) => (
              <option key={q.key} value={q.key}>{q.label}</option>
            ))}
          </select>
        </div>
        {choices.profileCount > 0 ? (
          <div className="sm:col-span-2">
            <label className={label} htmlFor={`${baseId}-profile`}>{t("profile")}</label>
            {choices.profiles.length > 0 ? (
              <select id={`${baseId}-profile`} value={item.profileSystem ?? ""} onChange={(e) => onPatch({ profileSystem: e.target.value || undefined })} className={field}>
                {groups.map((g) => (
                  <optgroup key={g} label={groupLabel(g)}>
                    {choices.profiles.filter((p) => p.group === g).map((p) => (
                      <option key={p.key} value={p.key}>{p.label}{p.uFrame ? ` · Uf ${p.uFrame.toFixed(2)}` : ""}</option>
                    ))}
                  </optgroup>
                ))}
                {choices.profiles.filter((p) => !p.group).map((p) => (
                  <option key={p.key} value={p.key}>{p.label}{p.uFrame ? ` · Uf ${p.uFrame.toFixed(2)}` : ""}</option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-[var(--color-text)]">{t("noProfilesForQuality")}</p>
            )}
            {chosenProfile?.spec && (chosenProfile.spec.chambers || chosenProfile.spec.depthMm) ? (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {[
                  chosenProfile.spec.chambers ? t("spec.chambers", { n: chosenProfile.spec.chambers }) : "",
                  chosenProfile.spec.depthMm ? t("spec.depth", { mm: chosenProfile.spec.depthMm }) : "",
                  chosenProfile.spec.gasket ? t(`spec.gasket_${chosenProfile.spec.gasket}`) : "",
                  chosenProfile.spec.maxGlassMm ? t("spec.maxGlass", { mm: chosenProfile.spec.maxGlassMm }) : "",
                ].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        <GlazingPicker
          idBase={baseId}
          value={item.glazing}
          choices={choices.glazing}
          heightMm={item.height}
          category={item.category}
          onChange={(key) => onPatch({ glazing: key })}
          selectClass={field}
          labelClass={label}
        />
        {choices.glazing.length < choices.glazingTotal ? (
          <p className="text-xs text-[var(--color-text-secondary)] sm:col-span-2">{t("glazingFiltered", { shown: choices.glazing.length, total: choices.glazingTotal, mm: chosenProfile?.spec.maxGlassMm ?? 0 })}</p>
        ) : null}
        {(() => {
          const finishes = choices.finishes.map((f) => ({ key: f.key, label: f.label, hex: f.swatch, texture: f.texture, range: f.range, group: f.group, warrantyYears: f.warrantyYears }));
          const bicolor = !!item.colorInside && item.colorInside !== item.color;
          return (
            <div className="space-y-3 sm:col-span-2">
              <FinishPicker idBase={baseId} value={item.color} finishes={finishes} onChange={(key) => onPatch({ color: key, ...(item.colorInside === key ? { colorInside: undefined } : {}) })} labelClass={label} label={bicolor ? t("colorOutside") : undefined} />
              {choices.bicolor ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[var(--color-mint)]"
                    checked={bicolor}
                    onChange={(e) => onPatch({ colorInside: e.target.checked ? (finishes.find((f) => f.key !== item.color)?.key ?? undefined) : undefined })}
                  />
                  <span>{t("bicolorToggle")}</span>
                </label>
              ) : null}
              {bicolor ? <FinishPicker idBase={`${baseId}-in`} value={item.colorInside!} finishes={finishes} onChange={(key) => onPatch({ colorInside: key === item.color ? undefined : key })} labelClass={label} label={t("colorInside")} /> : null}
            </div>
          );
        })()}
      </div>

      <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]" open={anyAccessory}>
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-[var(--color-text)]">{t("accessories")}</summary>
        <div className="space-y-3 border-t border-[var(--color-border)] p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor={`${baseId}-accessory-width`}>{t("accessoryWidth")}</label>
              <input id={`${baseId}-accessory-width`} name="accessoryWidth" type="number" step={10} min={100} max={6000} value={acc.width ?? ""} placeholder={String(item.width)} onChange={(e) => setAcc({ width: e.target.value ? Number(e.target.value) : undefined })} className={`${field} font-mono`} />
            </div>
            <div>
              <label className={label} htmlFor={`${baseId}-accessory-height`}>{t("accessoryHeight")}</label>
              <input id={`${baseId}-accessory-height`} name="accessoryHeight" type="number" step={10} min={100} max={6000} value={acc.height ?? ""} placeholder={String(item.height)} onChange={(e) => setAcc({ height: e.target.value ? Number(e.target.value) : undefined })} className={`${field} font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {choices.accessories.filter((g) => g.options.length > 0).map((g) => (
              <div key={g.category}>
                <label className={label} htmlFor={`${baseId}-acc-${g.category}`}>{ACCESSORY_CATEGORY_LABELS[g.category as AccessoryCategory][locale] ?? ACCESSORY_CATEGORY_LABELS[g.category as AccessoryCategory].it}</label>
                <select id={`${baseId}-acc-${g.category}`} value={acc[g.category as AccessoryCategory] ?? "none"} onChange={(e) => setAcc({ [g.category]: e.target.value === "none" ? undefined : e.target.value })} className={field}>
                  <option value="none">{t("none")}</option>
                  {g.options.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </details>

      <div>
        <label className={label} htmlFor={`${baseId}-notes`}>{t("notes")}</label>
        <textarea id={`${baseId}-notes`} value={item.notes ?? ""} onChange={(e) => onPatch({ notes: e.target.value })} rows={2} maxLength={500} placeholder={t("notesPlaceholder")} className={`${field} resize-y`} />
      </div>
    </div>
  );
}
