/**
 * Passport factory (#55): the unit-expansion and dossier-template logic
 * shared by the three creation paths in convex/passports.ts (create,
 * createBatchFromQuote, generatePassportQrs). Previously three copy-pasted
 * loops whose third copy silently lost its guards (issues #45, #47).
 */
import type { Id } from "../_generated/dataModel";
import { nanoid } from "./ids";
import { complianceForRegion } from "./compliance";
import type { RegionCode } from "./regions";

/** One label per physical unit of the quote (item × quantity). */
export function expandQuoteUnits(quote: { items?: unknown }): string[] {
  const rawItems = Array.isArray(quote.items) ? (quote.items as Record<string, unknown>[]) : [];
  const units: string[] = [];
  rawItems.forEach((it, i) => {
    const qty = Math.max(1, Math.round(Number(it.quantity ?? 1)));
    const kind = it.productType === "balconyDoor" ? "Porta-finestra" : "Finestra";
    const dims = [String(it.width ?? "?"), String(it.height ?? "?")].join("×");
    const base = [kind, dims].join(" ").trim() || ["Serramento", String(i + 1)].join(" ");
    for (let k = 0; k < qty; k++) {
      units.push(qty > 1 ? [base, [String(k + 1), String(qty)].join("/")].join(" ") : base);
    }
  });
  return units;
}

/**
 * The dossier fields every new passport starts from: sourced from the
 * region's compliance rules (create/batch) or copied from an existing
 * passport row (QR generation).
 */
export interface PassportTemplate {
  documents: Array<{ key: string; label: string; required: boolean }>;
  performanceDeclaration?: string;
  /** Optional in the schema: the QR path clones them from a stored row. */
  maintenanceLabel?: string;
  maintenancePriceCents?: number;
}

export function templateFromRegion(regionCode: RegionCode): PassportTemplate {
  const req = complianceForRegion(regionCode).dossier;
  return {
    documents: req.documents.map((d) => ({ key: d.key, label: d.label, required: d.required })),
    performanceDeclaration: req.performanceDeclaration,
    maintenanceLabel: req.maintenance.label,
    maintenancePriceCents: req.maintenance.defaultPriceCents,
  };
}

/** The identity + label fields that differ per creation path. */
export interface PassportSeed {
  tenantId: Id<"tenants">;
  regionCode: string;
  createdByUserId: Id<"users">;
  quoteId?: Id<"quoteRequests">;
  inspectionId?: Id<"inspectionReports">;
  label: string;
  customerName: string;
  siteAddress?: string;
  productSummary?: string;
  installedAt?: number;
  now: number;
}

/** A fresh passport row: template dossier fields + per-path identity and labels. */
export function passportDocFromTemplate(template: PassportTemplate, o: PassportSeed) {
  return {
    tenantId: o.tenantId,
    regionCode: o.regionCode,
    quoteId: o.quoteId,
    inspectionId: o.inspectionId,
    createdByUserId: o.createdByUserId,
    publicToken: nanoid(16),
    label: o.label,
    customerName: o.customerName,
    siteAddress: o.siteAddress,
    productSummary: o.productSummary,
    installedAt: o.installedAt,
    documents: template.documents.map((d) => ({ key: d.key, label: d.label, required: d.required })),
    performanceDeclaration: template.performanceDeclaration,
    maintenanceLabel: template.maintenanceLabel,
    maintenancePriceCents: template.maintenancePriceCents,
    maintenanceActive: false as const,
    scanCount: 0,
    createdAt: o.now,
    updatedAt: o.now,
  };
}
