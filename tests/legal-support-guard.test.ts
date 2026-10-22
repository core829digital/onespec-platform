// @vitest-environment node
import { describe, expect, test } from "vitest";
import { LEGAL_DOCS } from "../src/content/legal";
import { CONTACT_LIMITS, SUPPORT_LIMITS } from "../src/shared/support";
import { RETENTION_DAYS } from "../convex/retention";

/** The privacy notice states retention periods: they must be the ones the code really enforces. */
const text = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug)!.sections.flatMap((s) => s.p).join("\n");

describe("legal texts match the support system", () => {
  test("privacy notice states the real retention periods", () => {
    const p = text("privacy");
    expect(p).toContain(`${SUPPORT_LIMITS.retentionDays} giorni`);
    expect(p).toContain(`dopo ${SUPPORT_LIMITS.autoCloseDays} giorni`);
    expect(p).toContain(`${CONTACT_LIMITS.handledRetentionDays} giorni dopo essere stati gestiti`);
    expect(p).toContain(`${CONTACT_LIMITS.maxRetentionDays} giorni dalla ricezione`);
    expect(p).toMatch(/dopo 24 ore/); // pending attachments (cron: 24 h)
  });

  test("privacy notice states the retention windows of the logs and records the cron purges (issue #35)", () => {
    const p = text("privacy");
    expect(p).toContain(`Registro attività e log di sicurezza: eliminati automaticamente dopo ${RETENTION_DAYS.auditLog} giorni`);
    expect(p).toContain(`VIES: ${RETENTION_DAYS.viesChecks} giorni`);
    expect(p).toContain(`Stripe: ${RETENTION_DAYS.billingEvents} giorni`);
    expect(p).toContain(`showroom): ${RETENTION_DAYS.meteredEvents} giorni`);
    expect(p).toContain(`prova gratuita: ${RETENTION_DAYS.trialFingerprints} giorni`);
    expect(p).not.toContain("non esiste al momento una cancellazione automatica");
  });

  test("terms state the real attachment limits", () => {
    const t = text("termini-di-servizio");
    expect(t).toContain(`fino a ${SUPPORT_LIMITS.attachmentsPerMessage} file per messaggio`);
    expect(t).toContain(`${SUPPORT_LIMITS.attachmentMaxBytes / (1024 * 1024)} MB`);
    expect(t).toContain(`dopo ${SUPPORT_LIMITS.autoCloseDays} giorni`);
  });

  test("rights texts name the lead authority and the support data", () => {
    for (const slug of ["privacy", "gdpr"]) {
      const t = text(slug);
      expect(t).toContain("ANSPDCP");
      expect(t).toMatch(/ticket di assistenza/);
    }
  });
});
