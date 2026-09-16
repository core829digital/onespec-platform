"use client";

import { useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";

interface PDFViewerProps {
  document: React.ReactElement<any>;
  className?: string;
}

export function PDFViewerComponent({
  document,
  className = "",
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);

  return (
    <div className={`relative ${className}`}>
      <PDFViewer
        children={document}
        className="w-full"
        showToolbar={false}
      />
    </div>
  );
}