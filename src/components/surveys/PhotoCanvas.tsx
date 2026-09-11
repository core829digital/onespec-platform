"use client";

import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import Konva from "konva";

export interface PhotoCanvasProps {
  imageUrl: string;
  width?: number;
  height?: number;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
  children?: React.ReactNode;
}

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;

export function PhotoCanvas({
  imageUrl,
  width = MAX_WIDTH,
  height = MAX_HEIGHT,
  onImageLoad,
  children,
}: PhotoCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [stageSize, setStageSize] = useState({ width, height });
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const dims = { width: img.width, height: img.height };
      setImageElement(img);
      onImageLoad?.(dims);
      setImageLoaded(true);

      // Calculate scale to fit within max dimensions
      const maxW = width;
      const maxH = height;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      scaleRef.current = scale;
      setStageSize({ width: img.width * scale, height: img.height * scale });
    };
    img.src = imageUrl;
    return () => { img.onload = null; };
  }, [imageUrl, width, height, onImageLoad]);

  if (!imageLoaded || !imageElement) {
    return (
      <div className="w-full aspect-[4/3] bg-zinc-100 rounded-2xl flex items-center justify-center border-2 border-dashed">
        <div className="text-center text-zinc-500">
          <div className="text-4xl mb-2">📷</div>
          <p>{imageLoaded ? "Errore caricamento" : "Caricamento foto..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-zinc-100 rounded-2xl overflow-hidden border-2 border-dashed">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
      >
        <Layer>
          <KonvaImage
            image={imageElement}
            width={stageSize.width}
            height={stageSize.height}
          />
          {children}
        </Layer>
      </Stage>
    </div>
  );
}

export function useScale(getScale: () => number) {
  return getScale;
}