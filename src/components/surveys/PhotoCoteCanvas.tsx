import { useRef, useEffect, useState, useCallback } from "react";
import { PhotoCanvas } from "./PhotoCanvas";
import { AnnotationToolbar, ToolType } from "./AnnotationToolbar";
import { AnnotationLayer, type Annotation } from "./AnnotationLayer";
import { Stage, Layer, Image as KonvaImage, Line, Text, Rect, Circle } from "react-konva";
import Konva from "konva";

export interface PhotoCoteProps {
  imageUrl: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  readOnly?: boolean;
  tool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  width?: number;
  height?: number;
}

export { type Annotation };

type KonvaEvent = Konva.KonvaEventObject<MouseEvent>;

export function PhotoCoteCanvas({
  imageUrl,
  annotations,
  onAnnotationsChange,
  readOnly = false,
  tool = "select",
  onToolChange,
  width = 800,
  height = 600,
}: PhotoCoteProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [stageSize, setStageSize] = useState({ width, height });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newAnnotationStart, setNewAnnotationStart] = useState<{ x: number; y: number } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const dims = { width: img.width, height: img.height };
      setImageDimensions(dims);
      setImageElement(img);
      setImageLoaded(true);
      // Calculate scale to fit within max dimensions
      const scale = Math.min(width / img.width, height / img.height, 1);
      setStageSize({ width: img.width * scale, height: img.height * scale });
    };
    img.src = imageUrl;
    return () => { img.onload = null; };
  }, [imageUrl, width, height]);

  // Get scale from imageDimensions and stageSize
  const scale = imageDimensions ? stageSize.width / imageDimensions.width : 1;

  // Get arrowhead points for dimension/arrow annotations
  const getArrowheadPoints = (x1: number, y1: number, x2: number, y2: number, size: number = 10) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return [
      x2, y2,
      x2 - size * Math.cos(angle) + size * Math.sin(angle),
      y2 - size * Math.sin(angle) - size * Math.cos(angle),
      x2, y2,
      x2 - size * Math.cos(angle) - size * Math.sin(angle),
      y2 - size * Math.sin(angle) + size * Math.cos(angle),
    ];
  };

  // Calculate points in canvas coordinates
  const getCanvasPoints = (ann: Annotation) => {
    return ann.points.map((p, i) => (i % 2 === 0 ? p * scale : p * scale));
  };

  // Render annotations manually
  const renderAnnotations = () => {
    return annotations.map((ann) => {
      const pts = getCanvasPoints(ann);
      const isSelected = selectedId === ann.id;

      if (ann.type === "dimension" || ann.type === "arrow") {
        const [x1, y1, x2, y2] = pts;
        return (
          <Line
            key={ann.id}
            points={[x1, y1, x2, y2]}
            stroke={ann.color}
            strokeWidth={ann.strokeWidth * scale}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={20}
            onClick={(e: KonvaEvent) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
          >
            {ann.type === "arrow" && (
              <Line
                points={getArrowheadPoints(x1, y1, x2, y2, 10 * scale)}
                stroke={ann.color}
                strokeWidth={ann.strokeWidth * scale}
                closed
                fill={ann.color}
              />
            )}
          </Line>
        );
      }

      if (ann.type === "text") {
        const [x, y] = pts;
        return (
          <Text
            key={ann.id}
            x={x}
            y={y}
            text={ann.label || ""}
            fontSize={(ann.fontSize || 14) * scale}
            fontFamily="Inter"
            fill={ann.color}
            onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
          />
        );
      }

      if (ann.type === "rectangle" || ann.type === "roller" || ann.type === "sill" || ann.type === "frame") {
        const [x, y, w, h] = pts;
        return (
          <Rect
            key={ann.id}
            x={x}
            y={y}
            width={w}
            height={h}
            stroke={ann.color}
            strokeWidth={ann.strokeWidth * scale}
            fill={
              ann.type === "roller" ? "rgba(255,0,0,0.1)" :
              ann.type === "sill" ? "rgba(107,115,120,0.1)" :
              ann.type === "frame" ? "rgba(45,125,70,0.1)" : "transparent"
            }
            dash={ann.type === "rectangle" ? [5, 5] : undefined}
            hitStrokeWidth={20}
            onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
          />
        );
      }

      if (ann.type === "circle") {
        const [cx, cy, r] = pts;
        return (
          <Circle
            key={ann.id}
            x={cx}
            y={cy}
            radius={r}
            stroke={ann.color}
            strokeWidth={ann.strokeWidth * scale}
            fill="transparent"
            hitStrokeWidth={20}
            onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
          />
        );
      }

      return null;
    });
  };

  // Dimension labels
  const renderDimensionLabels = () => {
    return annotations
      .filter(a => a.type === "dimension" && a.label)
      .map((ann) => {
        const pts = getCanvasPoints(ann);
        const [x1, y1, x2, y2] = pts;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 15 * scale;
        return (
          <Text
            key={`label_${ann.id}`}
            x={mx}
            y={my}
            text={ann.label}
            fontSize={(ann.fontSize || 12) * scale}
            fontFamily="JetBrains Mono"
            fill={ann.color}
            stroke="white"
            strokeWidth={3 * scale}
            align="center"
          />
        );
      });
  };

  if (!imageLoaded) {
    return (
      <div className="w-full aspect-[4/3] bg-zinc-100 rounded-2xl flex items-center justify-center border-2 border-dashed">
        <div className="text-center text-zinc-500">
          <div className="text-4xl mb-2">📷</div>
          <p>Caricamento foto...</p>
        </div>
      </div>
    );
  }

  if (!imageDimensions) {
    return (
      <div className="w-full aspect-[4/3] bg-zinc-100 rounded-2xl flex items-center justify-center border-2 border-dashed">
        <div className="text-center text-zinc-500">
          <div className="text-4xl mb-2">📷</div>
          <p>Errore caricamento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {!readOnly && (
        <AnnotationToolbar tool={tool} onToolChange={onToolChange ?? (() => {})} readOnly={readOnly} />
      )}

      <div className="relative bg-zinc-100 rounded-2xl overflow-hidden border-2 border-dashed">
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
        >
          <Layer>
            {imageLoaded && imageElement && (
              <KonvaImage
                image={imageElement}
                width={stageSize.width}
                height={stageSize.height}
              />
            )}
            {renderAnnotations()}
            {renderDimensionLabels()}
          </Layer>
        </Stage>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
        <span>Click per iniziare • Drag per estendere • Del per cancellare</span>
        {selectedId && <span className="text-emerald-600">✓ Selezionato: premi Canc per rimuovere</span>}
      </div>
    </div>
  );
}