"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePdfImages } from "@/lib/pdf-images";

export interface PdfCompany {
  name: string;
  address?: string;
  vatId?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

/**
 * The caller's company profile (logo, VAT, address, contacts) in the shape the
 * PDF headers take. `ready` flips once the profile is loaded and the logo has
 * been made PDF-safe, so a document is never built without its logo.
 */
export function useCompanyPdf(fallbackName?: string): { ready: boolean; company: PdfCompany } {
  const profile = useQuery(api.tenants.getCompanyProfile);
  const urls = useMemo(() => [profile?.logoUrl], [profile?.logoUrl]);
  const { ready, map } = usePdfImages(urls);
  const logo = profile?.logoUrl ? map[profile.logoUrl] : null;
  return {
    ready: profile !== undefined && ready,
    company: {
      name: profile?.name ?? fallbackName ?? "Serramenti",
      address: profile?.address,
      vatId: profile?.vatId,
      phone: profile?.phone,
      email: profile?.email,
      logoUrl: logo ?? undefined,
    },
  };
}
