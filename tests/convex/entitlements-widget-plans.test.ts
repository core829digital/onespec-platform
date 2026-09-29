import { describe, expect, test } from "vitest";
import { entitlementsFor, isWidgetPlan, WIDGET_PLANS } from "../../convex/lib/entitlements";

/** The financial plan (docs/PIANO_ABBONAMENTI_WIDGET.md §3) as a literal table. */
const SPEC = {
  essentials: { quotes: 40, pdf: 15, wa: 40, configurators: 1, users: 1, showroom: false, sQuotes: 0, sPdf: 0, sWa: 0, logistics: false, whiteLabel: false },
  essentials_plus: { quotes: 80, pdf: 30, wa: 80, configurators: 3, users: 2, showroom: true, sQuotes: 80, sPdf: 30, sWa: 80, logistics: false, whiteLabel: true },
  max: { quotes: 200, pdf: 75, wa: 200, configurators: 10, users: 3, showroom: true, sQuotes: 200, sPdf: 75, sWa: 200, logistics: true, whiteLabel: true },
} as const;

describe("widget-first plans match the financial plan", () => {
  for (const plan of WIDGET_PLANS) {
    test(plan, () => {
      const e = entitlementsFor(plan);
      const s = SPEC[plan];
      expect(e.maxQuotesPerMonth).toBe(s.quotes);
      expect(e.maxPdfExportsPerMonth).toBe(s.pdf);
      expect(e.maxWhatsappSendsPerMonth).toBe(s.wa);
      expect(e.maxConfigurators).toBe(s.configurators);
      expect(e.maxTeamMembers).toBe(s.users);
      expect(e.showroomCalculator).toBe(s.showroom);
      expect(e.maxShowroomQuotesPerMonth).toBe(s.sQuotes);
      expect(e.maxShowroomPdfPerMonth).toBe(s.sPdf);
      expect(e.maxShowroomWhatsappPerMonth).toBe(s.sWa);
      expect(e.moduleLogistics).toBe(s.logistics);
      expect(e.whiteLabel).toBe(s.whiteLabel);
      // Always: widget on, no trial, monthly only, platform modules locked.
      expect(e.publicWidget).toBe(true);
      expect(e.trialEligible).toBe(false);
      expect(e.annualBilling).toBe(false);
      expect(e.analytics).toBe("none");
      expect(e.moduleFieldQuotes).toBe(false);
      expect(e.moduleCrm).toBe(false);
      expect(e.moduleCantieri).toBe(false);
      expect(e.moduleFieldOps).toBe(false);
      expect(e.fieldModules).toBe("rilievo_only");
      expect(e.multiSupplierAggregator).toBe(false);
      expect(e.apiAccess).toBe(false);
      expect(isWidgetPlan(plan)).toBe(true);
    });
  }

  test("legacy plans are not widget plans", () => {
    for (const p of ["base", "pro", "agency", "enterprise", "starter", "showroom", "business"]) {
      expect(isWidgetPlan(p)).toBe(false);
    }
  });

  test("logistics caps: none without the module, 3 on Max", () => {
    expect(entitlementsFor("essentials").maxLogisticsSuppliers).toBe(0);
    expect(entitlementsFor("essentials_plus").maxCarriers).toBe(0);
    expect(entitlementsFor("max").maxLogisticsSuppliers).toBe(3);
    expect(entitlementsFor("max").maxCarriers).toBe(3);
  });
});
