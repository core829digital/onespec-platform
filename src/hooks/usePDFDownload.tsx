"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";

interface UsePDFDownloadOptions {
  filename?: string;
}

export function usePDFDownload<T extends React.ComponentType<any>>(
  PDFFactory: T,
  options: UsePDFDownloadOptions = {}
) {
  const { filename = "document.pdf" } = options;

  const downloadPDF = useCallback(
    async (props: React.ComponentProps<T>) => {
      try {
        const blob = await pdf(<PDFFactory {...props} />).toBlob();
        saveAs(blob, filename);
      } catch (error) {
        console.error("Errore generazione PDF:", error);
        throw error;
      }
    },
    [PDFFactory, filename]
  );

  return { downloadPDF };
}