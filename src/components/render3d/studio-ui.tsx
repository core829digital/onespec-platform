"use client";

/** Small shared pieces of the studio: buttons, cards, and the animation / layout CSS of the full-screen layer. */
import type { CSSProperties, ReactNode } from "react";

export const cardStyle: CSSProperties = { border: "1px solid var(--color-border, #d1d5db)", borderRadius: 12, padding: 14, background: "var(--color-bg-alt, #f9fafb)" };
export const inputStyle: CSSProperties = { width: "100%", minHeight: 44, borderRadius: 8, border: "1px solid var(--color-border, #d1d5db)", padding: "8px 10px", fontSize: 16, background: "var(--color-bg, #fff)", color: "var(--color-text, #111827)" };

export const fill = (t: string, p: Record<string, string | number>) => Object.entries(p).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), t);

export function Btn({ children, onClick, primary, accent, disabled, testId, ariaPressed, compact }: { children: ReactNode; onClick?: () => void; primary?: boolean; accent: string; disabled?: boolean; testId?: string; ariaPressed?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      data-testid={testId}
      style={{
        minHeight: compact ? 40 : 44,
        padding: compact ? "6px 12px" : "8px 16px",
        borderRadius: 10,
        fontSize: compact ? 13 : 14,
        fontWeight: 650,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: `1.5px solid ${primary || ariaPressed ? accent : "var(--color-border, #d1d5db)"}`,
        background: primary ? accent : ariaPressed ? "var(--color-mint-light, #ecfdf5)" : "var(--color-bg, #fff)",
        color: primary ? "#fff" : "var(--color-text, #111827)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Layout and motion of the full-screen studio. A plain <style> (the widget and the app both allow inline styles): a few classes, a
 * panel that rises with a soft spring, a dock whose buttons press, and everything switched off for people who ask for less motion.
 */
export const STUDIO_CSS = `
.r3d-layer{position:fixed;inset:0;z-index:2147483000;background:#0b0f12;color:#f5f7f8;font-family:inherit;overscroll-behavior:contain;-webkit-tap-highlight-color:transparent;animation:r3d-fade .22s ease both}
.r3d-layer *{box-sizing:border-box}
.r3d-view{position:absolute;inset:0}
.r3d-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 10px calc(12px + env(safe-area-inset-left));pointer-events:none;z-index:3}
.r3d-top>*{pointer-events:auto}
.r3d-btn{white-space:nowrap}
@media (max-width:480px){.r3d-top{gap:6px}.r3d-btn{padding:0 10px;font-size:13px}}
.r3d-glass{background:rgba(18,24,28,.62);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 28px rgba(0,0,0,.35)}
.r3d-btn{min-width:44px;min-height:44px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;font-size:14px;font-weight:650;color:#f5f7f8;cursor:pointer;border:1px solid rgba(255,255,255,.14);background:rgba(18,24,28,.62);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:transform .12s ease,background .15s ease}
.r3d-btn:active{transform:scale(.94)}
.r3d-btn:hover{background:rgba(40,52,58,.78)}
.r3d-btn:focus-visible,.r3d-tab:focus-visible,.r3d-chip:focus-visible,.r3d-swatch:focus-visible{outline:3px solid var(--r3d-accent,#16d19d);outline-offset:2px}
.r3d-btn[aria-pressed="true"]{background:var(--r3d-accent,#16d19d);color:#06130e;border-color:transparent}
.r3d-spacer{flex:1}
.r3d-dock{position:absolute;z-index:3;display:flex;gap:6px;padding:6px;border-radius:20px}
.r3d-dock.v{left:calc(12px + env(safe-area-inset-left));top:50%;transform:translateY(-50%);flex-direction:column;max-height:calc(100% - 150px);overflow-y:auto;scrollbar-width:none}
.r3d-dock.h{left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));overflow-x:auto;scrollbar-width:none;justify-content:flex-start}
.r3d-dock::-webkit-scrollbar{display:none}
.r3d-tab{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:68px;min-height:56px;padding:6px 4px;border-radius:14px;border:0;background:transparent;color:#d6dde1;font-size:11px;font-weight:600;cursor:pointer;transition:background .15s ease,color .15s ease,transform .12s ease}
.r3d-tab:active{transform:scale(.93)}
.r3d-tab:hover{background:rgba(255,255,255,.08)}
.r3d-tab[aria-selected="true"]{background:var(--r3d-accent,#16d19d);color:#06130e}
.r3d-panel{position:absolute;z-index:4;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;animation:r3d-rise .26s cubic-bezier(.2,.9,.25,1.05) both}
.r3d-panel.v{left:calc(112px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));bottom:20px;width:min(380px,calc(100% - 140px))}
.r3d-panel.h{left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(84px + env(safe-area-inset-bottom));max-height:min(58%,calc(100% - 150px));animation-name:r3d-sheet}
.r3d-panel-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;font-weight:700;font-size:15px}
.r3d-panel-body{overflow-y:auto;padding:4px 14px 16px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.r3d-label{font-size:12.5px;font-weight:700;color:#cfd8dd;margin:0 0 6px}
.r3d-swatches{display:flex;flex-wrap:wrap;gap:8px;max-height:210px;overflow-y:auto;padding:3px}
.r3d-swatch{width:44px;height:44px;border-radius:12px;padding:0;cursor:pointer;border:2px solid rgba(255,255,255,.22);background-size:cover;transition:transform .12s ease,border-color .15s ease}
.r3d-swatch:active{transform:scale(.9)}
.r3d-swatch[aria-pressed="true"]{border-color:var(--r3d-accent,#16d19d);box-shadow:0 0 0 2px #0b0f12,0 0 0 4px var(--r3d-accent,#16d19d)}
.r3d-chips{display:flex;flex-wrap:wrap;gap:6px}
.r3d-chip{min-height:44px;padding:8px 14px;border-radius:12px;font-size:13.5px;font-weight:650;color:#f5f7f8;cursor:pointer;border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);transition:background .15s ease,transform .12s ease}
.r3d-chip:active{transform:scale(.95)}
.r3d-chip[aria-pressed="true"]{background:var(--r3d-accent,#16d19d);color:#06130e;border-color:transparent}
.r3d-select,.r3d-input{width:100%;min-height:44px;border-radius:12px;border:1.5px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#f5f7f8;font-size:16px;padding:8px 12px}
.r3d-select option{color:#111;background:#fff}
.r3d-note{font-size:12.5px;line-height:1.45;color:#b9c4ca;margin:0}
.r3d-card{border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.05);display:flex;flex-direction:column;gap:8px}
.r3d-hint{position:absolute;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2;max-width:min(560px,calc(100% - 32px));padding:8px 14px;border-radius:999px;font-size:12.5px;text-align:center;pointer-events:none;animation:r3d-fade .4s ease both}
.r3d-sheet-full{position:absolute;inset:0;z-index:6;background:#f3f5f6;color:#111827;overflow-y:auto;padding:calc(12px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left));animation:r3d-fade .2s ease both}
.r3d-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;z-index:5}
@keyframes r3d-fade{from{opacity:0}to{opacity:1}}
@keyframes r3d-rise{from{opacity:0;transform:translateX(-14px) scale(.97)}to{opacity:1;transform:none}}
@keyframes r3d-sheet{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.r3d-layer,.r3d-panel,.r3d-hint,.r3d-sheet-full{animation:none!important}.r3d-btn,.r3d-tab,.r3d-chip,.r3d-swatch{transition:none!important}}
@media (hover:none){.r3d-btn:hover,.r3d-tab:hover{background:inherit}}
`;
