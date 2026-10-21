/**
 * The PDF renderers of the drawings. Kept out of the main barrel (`@/lib/drawing`) on purpose: they import the whole PDF engine
 * (about 1.2 MB of JavaScript), and a barrel that re-exports them drags it into every page that merely draws a window on screen.
 * Only the PDF documents import from here.
 */
export { ScenePdf } from "./render-pdf";
export { WindowDrawingPdf, type WindowDrawingPdfProps } from "./WindowDrawingPdf";
