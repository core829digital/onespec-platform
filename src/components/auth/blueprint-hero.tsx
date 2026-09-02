import type { CSSProperties } from "react";

/**
 * Auth-scene hero: a window elevation that draws itself, then the width
 * dimension resolves from a measurement into a price — la quota diventa
 * quotazione. One orchestrated ~2.6s sequence; `prefers-reduced-motion` renders
 * the resolved state with no drawing.
 */
export function BlueprintHero() {
  const v = (delay: number, len = 1600): CSSProperties =>
    ({ "--delay": `${delay}s`, "--len": String(len) }) as CSSProperties;

  return (
    <div className="hidden lg:flex flex-col justify-between h-full p-12">
      <p className="auth-titleblock text-xs text-[var(--auth-text-dim)]">OneSpec · prospetto</p>

      <svg
        viewBox="0 0 380 340"
        role="img"
        aria-label="Disegno tecnico di una finestra: la quota di larghezza si trasforma in prezzo."
        className="w-full max-w-[26rem] mx-auto"
        fill="none"
        strokeLinecap="square"
      >
        {/* frame + mullion + sashes */}
        <g className="auth-draw" stroke="var(--auth-line)" strokeWidth={2}>
          <path d="M70 30 H330 V250 H70 Z" style={v(0.15)} />
          <line x1="200" y1="30" x2="200" y2="250" style={v(0.55)} />
          {/* left sash: fixed pane marker (single diagonal) */}
          <line x1="82" y1="238" x2="188" y2="42" stroke="var(--auth-line-dim)" style={v(0.8)} />
          {/* right sash: tilt & turn swing triangle (hinge on right edge) */}
          <line x1="212" y1="40" x2="322" y2="140" style={v(0.95)} />
          <line x1="212" y1="240" x2="322" y2="140" style={v(1.05)} />
          {/* vasistas chevron */}
          <polyline points="250,232 262,218 274,232" strokeWidth={1.75} style={v(1.2)} />
        </g>

        {/* one edge goes "live" — dim draft line resolves to mint */}
        <line
          x1="70"
          y1="30"
          x2="330"
          y2="30"
          strokeWidth={2.5}
          className="auth-live-stroke"
          style={{ "--len": "320" } as CSSProperties}
        />

        {/* width dimension line with tick serifs + extension lines */}
        <g className="auth-draw" stroke="var(--auth-line)" strokeWidth={1}>
          <line x1="70" y1="256" x2="70" y2="286" style={v(1.35)} />
          <line x1="330" y1="256" x2="330" y2="286" style={v(1.35)} />
          <line x1="70" y1="278" x2="330" y2="278" style={v(1.5)} />
          <line x1="64" y1="284" x2="76" y2="272" style={v(1.7)} />
          <line x1="324" y1="284" x2="336" y2="272" style={v(1.7)} />
        </g>

        {/* height dimension line */}
        <g className="auth-draw" stroke="var(--auth-line)" strokeWidth={1}>
          <line x1="70" y1="30" x2="44" y2="30" style={v(1.4)} />
          <line x1="70" y1="250" x2="44" y2="250" style={v(1.4)} />
          <line x1="48" y1="30" x2="48" y2="250" style={v(1.55)} />
        </g>
        <text
          x="30"
          y="140"
          className="auth-data auth-fade"
          style={v(1.9)}
          fontSize="11"
          fill="var(--auth-text-dim)"
          textAnchor="middle"
          transform="rotate(-90 30 140)"
        >
          1400 mm
        </text>

        {/* the signature: 1200 mm  →  1.240 € */}
        <g textAnchor="middle" fontSize="13" className="auth-data">
          <rect x="163" y="292" width="74" height="20" rx="3" fill="var(--auth-bg)" />
          <text x="200" y="306" className="auth-morph-mm" fill="var(--auth-text-dim)">
            1200 mm
          </text>
          <text x="200" y="306" className="auth-morph-eur" fill="var(--auth-live)" fontWeight="600">
            1.240 €
          </text>
        </g>
      </svg>

      {/* drafting titleblock (cartiglio) */}
      <dl className="auth-titleblock grid grid-cols-2 gap-x-8 gap-y-2 text-[0.7rem] text-[var(--auth-text-dim)] border-t border-[var(--auth-line-dim)] pt-5 max-w-[26rem] mx-auto w-full">
        <div className="flex justify-between">
          <dt>scala</dt>
          <dd className="auth-data text-[var(--auth-text)]">1:10</dd>
        </div>
        <div className="flex justify-between">
          <dt>materiale</dt>
          <dd className="auth-data text-[var(--auth-text)]">PVC</dd>
        </div>
        <div className="flex justify-between">
          <dt>Uw</dt>
          <dd className="auth-data text-[var(--auth-text)]">1.1</dd>
        </div>
        <div className="flex justify-between">
          <dt>revisione</dt>
          <dd className="auth-data text-[var(--auth-text)]">α</dd>
        </div>
        <div className="col-span-2 flex justify-between border-t border-[var(--auth-line-dim)] pt-2 mt-1">
          <dt>programma alpha</dt>
          <dd className="auth-data text-[var(--auth-live)]">250 posti</dd>
        </div>
      </dl>
    </div>
  );
}

/** Compact strip shown above the form on small screens. */
export function BlueprintStrip() {
  return (
    <svg
      viewBox="0 0 320 44"
      role="img"
      aria-label="Quota che si trasforma in prezzo"
      className="lg:hidden w-full h-11 mb-6"
      fill="none"
    >
      <g className="auth-draw" stroke="var(--auth-line)" strokeWidth={1} style={{ "--len": "700" } as CSSProperties}>
        <line x1="14" y1="8" x2="14" y2="28" />
        <line x1="200" y1="8" x2="200" y2="28" />
        <line x1="14" y1="18" x2="200" y2="18" style={{ "--delay": "0.2s" } as CSSProperties} />
      </g>
      <g textAnchor="middle" fontSize="12" className="auth-data">
        <text x="107" y="12" className="auth-morph-mm" fill="var(--auth-text-dim)">
          1200 mm
        </text>
        <text x="250" y="23" className="auth-morph-eur" fill="var(--auth-live)" fontWeight="600">
          1.240 €
        </text>
      </g>
    </svg>
  );
}
