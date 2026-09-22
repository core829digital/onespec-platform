"use client";

import { useTranslations } from "next-intl";
import { ACCESSORY_CATEGORY_LABELS, type AccessoryCategory } from "@/shared/configurator-model";
import type { ProjectItem } from "@/shared/pricing";
import type { catalogChoices } from "./catalog-labels";

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
  const tabs = Array.from(new Set(choices.profiles.map((p) => p.group).filter(Boolean))) as string[];
  const acc = item.accessories ?? {};
  const setAcc = (patch: Partial<NonNullable<ProjectItem["accessories"]>>) => onPatch({ accessories: { ...acc, ...patch } });
  const anyAccessory = (["zanz", "cass", "avv", "pers"] as const).some((c) => acc[c] && acc[c] !== "none");

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
        {choices.profiles.length > 0 ? (
          <div className="sm:col-span-2">
            <label className={label} htmlFor={`${baseId}-profile`}>{t("profile")}</label>
            <select id={`${baseId}-profile`} value={item.profileSystem ?? ""} onChange={(e) => onPatch({ profileSystem: e.target.value || undefined })} className={field}>
              {tabs.length > 0
                ? tabs.map((g) => (
                    <optgroup key={g} label={g === "tab1" ? t("groupValue") : g === "tab2" ? t("groupPremium") : g}>
                      {choices.profiles.filter((p) => p.group === g).map((p) => (
                        <option key={p.key} value={p.key}>{p.label}{p.uFrame ? ` · Uf ${p.uFrame.toFixed(2)}` : ""}</option>
                      ))}
                    </optgroup>
                  ))
                : null}
              {choices.profiles.filter((p) => !p.group).map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className={label} htmlFor={`${baseId}-glazing`}>{t("glazing")}</label>
          <select id={`${baseId}-glazing`} value={item.glazing} onChange={(e) => onPatch({ glazing: e.target.value })} className={field}>
            {choices.glazing.map((g) => (
              <option key={g.key} value={g.key}>{g.label}{g.uGlass ? ` · Ug ${g.uGlass}` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`${baseId}-finish`}>{t("finish")}</label>
          <div className="flex items-center gap-2">
            <select id={`${baseId}-finish`} value={item.color} onChange={(e) => onPatch({ color: e.target.value })} className={field}>
              {choices.finishes.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-md border border-[var(--color-border)]" style={{ background: choices.finishes.find((f) => f.key === item.color)?.swatch ?? "transparent" }} />
          </div>
        </div>
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
