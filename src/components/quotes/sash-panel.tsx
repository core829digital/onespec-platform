"use client";

import { useTranslations } from "next-intl";
import {
  SASH_KINDS,
  SECURITY_CLASSES,
  sashTypeAllowedWith,
  openingSide,
  directionFromOpening,
  directionOnRetype,
  hasOpeningDirection,
  isOperable,
  type EditorSash,
  type LeafRule,
  type SashKind,
} from "@/shared/sash-rules";
import { handleRange } from "@/shared/configurator-model";

interface Props {
  sash: EditorSash;
  index: number;
  siblingTypes: SashKind[];
  /** Technical rule that applies to this leaf (movable / fixed mullion, inactive leaf...). */
  rule?: LeafRule | null;
  itemHeightMm: number;
  hardwareOptions: [string, string][];
  hardwareColorOptions: [string, string][];
  onPatch: (patch: Partial<EditorSash>) => void;
  onClose: () => void;
}

const sel =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";
const lbl = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1";

export function SashPanel({
  sash,
  index,
  siblingTypes,
  rule,
  itemHeightMm,
  hardwareOptions,
  hardwareColorOptions,
  onPatch,
  onClose,
}: Props) {
  const t = useTranslations("sash");
  const { min: handleMin, max: handleMax } = handleRange(itemHeightMm);
  const handle = sash.handleHeightMm ?? Math.round(itemHeightMm / 2);
  const operable = isOperable(sash.type);
  // A tilt-only (vasistas) or fixed leaf has a single way of moving: no direction to pick.
  const hasDirection = sash.active && hasOpeningDirection(sash.type);
  const picked = openingSide(sash.type, sash.direction);

  return (
    <div className="rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t("leaf", { n: index + 1 })}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          {t("close")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl} htmlFor={`sash-${index}-type`}>{t("openingType")}</label>
          <select
            id={`sash-${index}-type`}
            className={sel}
            value={sash.type}
            onChange={(e) => {
              const next = e.target.value as SashKind;
              const check = sashTypeAllowedWith(siblingTypes, next);
              if (!check.ok) {
                alert(check.mix ? t(`mix_${check.mix}`) : check.reason);
                return;
              }
              onPatch({ type: next, direction: directionOnRetype(sash.type, sash.direction, next) });
            }}
          >
            {SASH_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind_${k}`)}
              </option>
            ))}
          </select>
        </div>
        {hasDirection ? (
          <div>
            <label className={lbl}>{t("direction")}</label>
            <div className="flex gap-1">
              {(["left", "right"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={picked === d}
                  title={t("directionHint")}
                  onClick={() => onPatch({ direction: directionFromOpening(sash.type, d) })}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                    picked === d
                      ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-mint)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {d === "left" ? t("left") : t("right")}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-secondary)]">{t("directionHint")}</p>
          </div>
        ) : sash.type === "tilt" && sash.active ? (
          <p className="self-end pb-2 text-[11px] leading-snug text-[var(--color-text-secondary)]">{t("tiltNote")}</p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={sash.active}
          onChange={(e) => onPatch({ active: e.target.checked })}
          className="h-4 w-4 rounded border-[var(--color-border)]"
        />
        <span>{sash.active ? t("operable") : t("fixedPanel")}</span>
      </label>

      {rule ? (
        <p className="rounded-md bg-[var(--color-bg-alt)] px-2 py-1.5 text-[11px] leading-snug text-[var(--color-text-secondary)]" role="note">{t(`rule_${rule}`)}</p>
      ) : null}

      {operable && sash.active && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl} htmlFor={`sash-${index}-hardware`}>{t("hardware")}</label>
              <select id={`sash-${index}-hardware`} className={sel} value={sash.hardware} onChange={(e) => onPatch({ hardware: e.target.value })}>
                {hardwareOptions.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl} htmlFor={`sash-${index}-hardware-color`}>{t("hardwareColor")}</label>
              <select
                id={`sash-${index}-hardware-color`}
                className={sel}
                value={sash.hardwareColor}
                onChange={(e) => onPatch({ hardwareColor: e.target.value })}
              >
                {hardwareColorOptions.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl} htmlFor={`sash-${index}-security-class`}>{t("securityClass")}</label>
            <select
              id={`sash-${index}-security-class`}
              className={sel}
              value={sash.securityClass ?? "standard"}
              onChange={(e) => onPatch({ securityClass: e.target.value as EditorSash["securityClass"] })}
            >
              {SECURITY_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {t(`sec_${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={lbl} htmlFor={`sash-${index}-handle`}>{t("handleHeight")}</label>
              <span className="font-mono text-xs font-bold text-[var(--color-text)]">{handle} mm</span>
            </div>
            <input
              id={`sash-${index}-handle`}
              type="range"
              min={handleMin}
              max={handleMax}
              step={10}
              value={Math.min(handleMax, Math.max(handleMin, handle))}
              onChange={(e) => onPatch({ handleHeightMm: Number(e.target.value) })}
              disabled={rule === "inactive"}
              className="w-full accent-[var(--color-mint)] disabled:opacity-40"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={sash.main === true}
              disabled={rule === "inactive"}
              onChange={(e) => onPatch({ main: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--color-border)]"
            />
            <span>{t("main")}</span>
          </label>
        </>
      )}
    </div>
  );
}
