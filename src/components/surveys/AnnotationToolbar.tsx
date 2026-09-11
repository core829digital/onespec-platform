"use client";

export type ToolType = 
  | "select" 
  | "dimension" 
  | "arrow" 
  | "text" 
  | "rectangle" 
  | "roller" 
  | "sill" 
  | "frame";

export interface AnnotationToolbarProps {
  tool: ToolType;
  onToolChange: (tool: ToolType) => void;
  readOnly?: boolean;
}

const TOOL_LABELS: Record<ToolType, string> = {
  select: "Seleziona",
  dimension: "Cota (L/H)",
  arrow: "Freccia",
  text: "Testo",
  rectangle: "Rettangolo",
  roller: "Rulou",
  sill: "Davanzale",
  frame: "Controtelaio",
};

const TOOL_ICONS: Record<ToolType, string> = {
  select: "🖱️",
  dimension: "📏",
  arrow: "➡️",
  text: "📝",
  rectangle: "⬜",
  roller: "🪟",
  sill: "📐",
  frame: "🏗️",
};

const TOOLS_ORDER: ToolType[] = [
  "select", 
  "dimension", 
  "arrow", 
  "text", 
  "rectangle", 
  "roller", 
  "sill", 
  "frame"
];

export function AnnotationToolbar({ 
  tool, 
  onToolChange, 
  readOnly = false 
}: AnnotationToolbarProps) {
  if (readOnly) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1" role="toolbar" aria-label="Strumenti annotazione">
      {TOOLS_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onToolChange(key)}
          disabled={readOnly}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            tool === key
              ? "bg-zinc-900 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
          aria-pressed={tool === key}
          title={`${TOOL_ICONS[key]} ${TOOL_LABELS[key]}`}
        >
          <span className="flex items-center gap-1">
            {TOOL_ICONS[key]}
            <span className="hidden sm:inline">{TOOL_LABELS[key]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}