"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";

interface UsePDFDownloadOptions {
  filename?: string;
}

// Generic constraint needs to accept any component's prop shape; there's no
// type-safe substitute for `any` here (unknown/Record don't satisfy JSX's
// LibraryManagedAttributes inference for an arbitrary ComponentType).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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