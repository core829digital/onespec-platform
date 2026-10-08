"use client";

import { DRAWING_TABS, drawingLocale, type DrawingTab } from "@/lib/drawing";

interface Props {
  tabs: DrawingTab[];
  value: DrawingTab;
  onChange: (tab: DrawingTab) => void;
  locale: string;
}

/** Tab strip above the technical drawings: elevation, plan, section, ... (arrow keys move between tabs). */
export function DrawingTabs({ tabs, value, onChange, locale }: Props) {
  const labels = DRAWING_TABS[drawingLocale(locale)];
  const move = (dir: 1 | -1) => {
    const i = tabs.indexOf(value);
    onChange(tabs[(i + dir + tabs.length) % tabs.length]);
  };
  return (
    <div
      role="tablist"
      aria-label={labels.elevation + " / " + labels.plan}
      className="mb-3 flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`drawing-tab-${tab}`}
          aria-selected={value === tab}
          aria-controls={`drawing-panel-${tab}`}
          tabIndex={value === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          className={`min-h-10 rounded-md px-3 py-1 text-xs font-medium transition-colors sm:min-h-0 ${
            value === tab
              ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]"
          }`}
        >
          {labels[tab]}
        </button>
      ))}
    </div>
  );
}
