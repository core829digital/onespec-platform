"use client";

import {
  SASH_KINDS,
  SASH_KIND_LABEL,
  SECURITY_CLASSES,
  SECURITY_LABEL,
  sashTypeAllowedWith,
  isOperable,
  type EditorSash,
  type SashKind,
} from "@/shared/sash-rules";

interface Props {
  sash: EditorSash;
  index: number;
  siblingTypes: SashKind[];
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
  itemHeightMm,
  hardwareOptions,
  hardwareColorOptions,
  onPatch,
  onClose,
}: Props) {
  const handleMin = 400;
  const handleMax = Math.max(handleMin + 100, itemHeightMm - 150);
  const handle = sash.handleHeightMm ?? Math.round(itemHeightMm / 2);
  const operable = isOperable(sash.type);

  return (
    <div className="rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Anta {index + 1}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Chiudi
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Tipo apertura</label>
          <select
            className={sel}
            value={sash.type}
            onChange={(e) => {
              const next = e.target.value as SashKind;
              const check = sashTypeAllowedWith(siblingTypes, next);
              if (!check.ok) {
                alert(check.reason);
                return;
              }
              onPatch({ type: next });
            }}
          >
            {SASH_KINDS.map((k) => (
              <option key={k} value={k}>
                {SASH_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Verso (vista interna)</label>
          <div className="flex gap-1">
            {(["left", "right"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onPatch({ direction: d })}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold ${
                  sash.direction === d
                    ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                }`}
              >
                {d === "left" ? "Sx ◄" : "Dx ►"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={sash.active}
          onChange={(e) => onPatch({ active: e.target.checked })}
          className="h-4 w-4 rounded border-[var(--color-border)]"
        />
        <span>{sash.active ? "Anta apribile" : "Pannello fisso / cieco"}</span>
      </label>

      {operable && sash.active && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Ferramenta</label>
              <select className={sel} value={sash.hardware} onChange={(e) => onPatch({ hardware: e.target.value })}>
                {hardwareOptions.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Colore ferramenta</label>
              <select
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
            <label className={lbl}>Classe di sicurezza</label>
            <select
              className={sel}
              value={sash.securityClass ?? "standard"}
              onChange={(e) => onPatch({ securityClass: e.target.value as EditorSash["securityClass"] })}
            >
              {SECURITY_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {SECURITY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={lbl}>Altezza maniglia dal pavimento</label>
              <span className="font-mono text-xs font-bold text-[var(--color-text)]">{handle} mm</span>
            </div>
            <input
              type="range"
              min={handleMin}
              max={handleMax}
              step={10}
              value={Math.min(handleMax, Math.max(handleMin, handle))}
              onChange={(e) => onPatch({ handleHeightMm: Number(e.target.value) })}
              className="w-full accent-[var(--color-mint)]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={sash.main === true}
              onChange={(e) => onPatch({ main: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--color-border)]"
            />
            <span>Anta principale</span>
          </label>
        </>
      )}
    </div>
  );
}
