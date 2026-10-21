"use client";

import { useTranslations } from "next-intl";
import { glazingAdvice, PACKAGE_DEPTHS, packageKey, parseGlazingKey, type GlazingFamily } from "@/shared/glazing-packages";

export interface GlazingChoice {
  key: string;
  label: string;
  uGlass?: number;
}

interface Props {
  idBase: string;
  value: string;
  choices: GlazingChoice[];
  heightMm: number;
  category?: string;
  onChange: (key: string) => void;
  selectClass: string;
  labelClass: string;
}

/**
 * Glazing in two steps: first the depth of the unit (double 24/26/28 mm, triple 32-52 mm), then the composition
 * available at that depth. The result is one catalogue key. A quote saved with an older key keeps showing it.
 */
export function GlazingPicker({ idBase, value, choices, heightMm, category, onChange, selectClass, labelClass }: Props) {
  const t = useTranslations("glazingPicker");
  const byKey = new Map(choices.map((c) => [c.key, c]));
  const parsed = parseGlazingKey(value);
  const available = choices.map((c) => ({ choice: c, p: parseGlazingKey(c.key) })).filter((x) => x.p !== null) as Array<{ choice: GlazingChoice; p: NonNullable<ReturnType<typeof parseGlazingKey>> }>;

  // Without package rows in the catalogue (older catalogue not updated yet) the picker is the plain list.
  if (available.length === 0) {
    return (
      <div>
        <label className={labelClass} htmlFor={`${idBase}-glazing`}>{t("glazing")}</label>
        <select id={`${idBase}-glazing`} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          {choices.map((g) => (
            <option key={g.key} value={g.key}>{g.label}{g.uGlass ? ` · Ug ${g.uGlass}` : ""}</option>
          ))}
        </select>
      </div>
    );
  }

  const depthOptions: Array<{ family: GlazingFamily; depth: number }> = [];
  for (const family of ["double", "triple"] as const) {
    for (const depth of PACKAGE_DEPTHS[family]) {
      if (available.some((x) => x.p.family === family && x.p.depthMm === depth)) depthOptions.push({ family, depth });
    }
  }
  const depthValue = parsed ? `${parsed.family}-${parsed.depthMm}` : "legacy";
  const compositions = parsed ? available.filter((x) => x.p.family === parsed.family && x.p.depthMm === parsed.depthMm) : [];
  const advice = glazingAdvice(value, heightMm, category);

  const pickDepth = (raw: string) => {
    const [family, depth] = raw.split("-") as [GlazingFamily, string];
    const sameComposition = parsed ? parseGlazingKey(packageKey(family, Number(depth), parsed.composition.id)) : null;
    if (sameComposition && byKey.has(packageKey(family, Number(depth), parsed!.composition.id))) {
      onChange(packageKey(family, Number(depth), parsed!.composition.id));
      return;
    }
    const first = available.find((x) => x.p.family === family && x.p.depthMm === Number(depth));
    if (first) onChange(first.choice.key);
  };

  return (
    <div className="space-y-2">
      <div>
        <label className={labelClass} htmlFor={`${idBase}-glazing-depth`}>{t("depth")}</label>
        <select id={`${idBase}-glazing-depth`} value={depthValue} onChange={(e) => pickDepth(e.target.value)} className={selectClass}>
          {!parsed ? <option value="legacy" disabled>{byKey.get(value)?.label ?? value}</option> : null}
          {depthOptions.map(({ family, depth }) => (
            <option key={`${family}-${depth}`} value={`${family}-${depth}`}>{t(family)} · {depth} mm</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idBase}-glazing`}>{t("composition")}</label>
        <select
          id={`${idBase}-glazing`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!parsed}
          className={selectClass}
        >
          {!parsed ? <option value={value}>{byKey.get(value)?.label ?? value}</option> : null}
          {compositions.map(({ choice }) => (
            <option key={choice.key} value={choice.key}>{compositionLabel(choice.label)}{choice.uGlass ? ` · Ug ${choice.uGlass}` : ""}</option>
          ))}
        </select>
      </div>
      {advice.map((code) => (
        <p key={code} role="note" className={`text-[11px] leading-snug ${code === "tooTall" || code === "tallBeyond" ? "text-[var(--color-warning,#B45309)]" : "text-[var(--color-text-secondary)]"}`}>
          {t(`advice_${code}`)}
        </p>
      ))}
    </div>
  );
}

/** Labels of the rows end with " · NN mm": the depth is already chosen above. */
function compositionLabel(label: string): string {
  return label.replace(/\s·\s\d+\smm$/, "");
}
