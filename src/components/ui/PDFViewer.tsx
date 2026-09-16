"use client";

import { PDFViewer } from "@react-pdf/renderer";

// @react-pdf/renderer's own type for <PDFViewer style={...}> is its internal
// PDF-layout StyleProp (the yoga-based style object used inside documents),
// not real CSS — but at runtime (see react-pdf.browser.js) the component is
// a bare `<iframe style={style} ...props />`, so it's actually real
// DOM CSSProperties. This cast just corrects the type to match reality.
const IframePDFViewer = PDFViewer as unknown as React.ComponentType<{
  children: React.ReactElement<any>;
  showToolbar?: boolean;
  style?: React.CSSProperties;
}>;

interface PDFViewerProps {
  document: React.ReactElement<any>;
  className?: string;
  /** Iframe height. @react-pdf/renderer's <PDFViewer> is a bare <iframe> —
   * it applies no default sizing at all, so without an explicit height it
   * falls back to the browser's built-in unstyled-iframe default of
   * ~150px. That's the "broken UI" on every PDF preview in the app: a
   * sliver of page at the top of a mostly-blank 800px box. */
  height?: string;
}

export function PDFViewerComponent({
  document,
  className = "",
  height = "80vh",
}: PDFViewerProps) {
  return (
    <div className={`relative ${className}`}>
      <IframePDFViewer
        children={document}
        showToolbar={false}
        style={{ width: "100%", height, border: "none" }}
      />
    </div>
  );
}
