import { buildScene } from "./build-scene";
import { ScenePdf } from "./render-pdf";
import type { DrawingInput, DrawingOptions } from "./types";

export interface WindowDrawingPdfProps {
  input: DrawingInput;
  options?: DrawingOptions;
  /** Rendered width in PDF points; height follows the drawing's own aspect. */
  width?: number;
}

/** Static react-pdf rendering of the same Scene the DOM component draws. */
export function WindowDrawingPdf({ input, options, width = 170 }: WindowDrawingPdfProps) {
  return <ScenePdf scene={buildScene(input, options)} width={width} />;
}
