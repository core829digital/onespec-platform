import { describe, expect, test } from "vitest";
import { DEFAULT_ACCESSORIES, DEFAULT_FRAME_TYPES } from "../src/shared/configurator-model";
import { defaultItem } from "../src/shared/item-defaults";
import type { CatalogPayload, ProjectItem } from "../src/shared/pricing";
import { buildBackup, parseBackup } from "../src/lib/quote-export/backup";
import { buildHtml, buildMailto, buildTxt, buildWhatsApp, whatsAppDigits, whatsAppUrl } from "../src/lib/quote-export/generators";
import { buildExportModel } from "../src/lib/quote-export/model";

const payload = {
  configurator: { vatRatePercent: 10, priceRoundingStep: 1, currency: "EUR" },
  branding: null,
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, uFrameBase: 1.3, sortOrder: 0, enabled: true }],
  qualityTiers: [{ materialKey: "pvc", key: "chamber5", labels: { it: "5 camere" }, multiplier: 1, sortOrder: 0, enabled: true }],
  profileSystems: [{ materialKey: "pvc", key: "rehau", labels: { it: "Rehau Synego" }, multiplier: 1, uFrame: 1, sortOrder: 0, enabled: true }],
  sizeConstraints: [],
  glazing: [{ key: "double", labels: { it: "Doppio 4/20/4", en: "Double 4/20/4" }, priceCents: 0, uGlass: 1.1, sortOrder: 0, enabled: true }],
  finish: [{ key: "white", labels: { it: "Bianco", en: "White" }, priceCents: 0, sortOrder: 0, enabled: true }],
  hardware: [
    { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 5000, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "sashType", key: "classic", labels: { it: "B" }, priceCents: 3000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "hardware", key: "standard", labels: { it: "Standard" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "hardwareColor", key: "silver", labels: { it: "Argento" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  ],
  frameTypes: DEFAULT_FRAME_TYPES,
  accessories: DEFAULT_ACCESSORIES,
} as unknown as CatalogPayload;

function model(locale = "it", over: Partial<ProjectItem> = {}, drawings = false) {
  const item = { ...defaultItem(payload, "finestra2"), profileSystem: "rehau", frameType: "reno40", notes: "senza zanzariera", accessories: { zanz: "plisettata" }, ...over };
  return buildExportModel({
    locale,
    offerNumber: "Q-2026-0007",
    dateMs: Date.UTC(2026, 8, 21, 10),
    company: { name: "Acme Serramenti", address: "Via Roma 1, Prato", vatId: "IT0123", phone: "+39 0574 1", email: "info@acme.it" },
    client: { name: "Mario Rossi", phone: "340 1234567", city: "Prato", email: "mario@example.com" },
    items: [item],
    payload,
    money: { supplyExVatCents: 73008, installCents: 20500, demolitionCents: 0, regionalCents: 0, discountPercent: 0, vatPercent: 10, grossCents: 102859, subsidyPercent: 50, subsidyCents: 51430 },
    validityDays: 30,
    terms: ["Garanzia 10 anni profilo"],
    drawings,
  });
}

describe("export model", () => {
  test("resolves catalogue labels, leaves with handle heights and the weighted Uw", () => {
    const m = model();
    const p = m.pieces[0];
    expect(p.category).toBe("Finestra 2 ante");
    expect(p.profile).toBe("Rehau Synego");
    expect(p.frame).toBe("Ristrutturazione 40mm");
    expect(p.accessories).toEqual(["Zanzariera Plisettata"]);
    expect(p.leaves).toHaveLength(2);
    expect(p.leaves[1]).toMatchObject({ hinge: "DX", type: "Anta-ribalta", main: true, handleMm: 700, widthMm: 600 });
    expect(m.overallUw).toBeGreaterThan(0.5);
    expect(p.totalCents).toBeGreaterThan(0);
  });

  test("drawings are embedded as inline SVG only when asked", () => {
    expect(model("it", {}, false).pieces[0].drawingSvg).toBeUndefined();
    expect(model("it", {}, true).pieces[0].drawingSvg).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
});

describe("text exports", () => {
  test("TXT carries offer number, pieces, leaves, accessories, notes, totals and the incentive", () => {
    const txt = buildTxt(model());
    expect(txt).toContain("Q-2026-0007");
    expect(txt).toContain("Mario Rossi");
    expect(txt).toContain("1. Finestra 2 ante 1200x1400 mm × 1 — Rehau Synego");
    expect(txt).toContain("Anta 2: DX Anta-ribalta (principale) · 600 mm · maniglia 700 mm");
    expect(txt).toContain("Accessori: Zanzariera Plisettata");
    expect(txt).toContain("Osservazioni: senza zanzariera");
    expect(txt).toContain("COEFFICIENTE TERMICO GENERALE");
    expect(txt).toContain("TOTALE CHIAVI IN MANO");
    expect(txt).toContain("TOTALE DOPO DETRAZIONE");
    expect(txt).toContain("Validità 30 giorni - Garanzia 10 anni profilo");
  });

  test("the language follows the locale", () => {
    const en = buildTxt(model("en"));
    expect(en).toContain("QUOTATION");
    expect(en).toContain("Turnkey total".toUpperCase());
    expect(en).toContain("Double 4/20/4");
  });

  test("WhatsApp text is compact and does not promise an attachment it cannot send", () => {
    const wa = buildWhatsApp(model());
    expect(wa).toContain("Buongiorno! Le invio l'offerta N. Q-2026-0007.");
    expect(wa).toContain("1. Finestra 2 ante: 1200x1400 mm × 1");
    expect(wa).toContain("Il dettaglio completo con i disegni è nel PDF dell'offerta.");
  });

  test("mailto encodes subject and body", () => {
    const { url, subject } = buildMailto(model());
    expect(subject).toBe("Offerta Q-2026-0007 — Mario Rossi");
    expect(url.startsWith("mailto:mario@example.com?subject=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Cordiali saluti"));
  });
});

describe("whatsapp numbers", () => {
  test("national numbers get the market prefix, international ones are kept, junk is rejected", () => {
    expect(whatsAppDigits("340 123 4567", "IT")).toBe("393401234567");
    expect(whatsAppDigits("0574 123456", "IT")).toBe("39574123456");
    expect(whatsAppDigits("+39 340 1234567", "IT")).toBe("393401234567");
    expect(whatsAppDigits("0039 340 1234567", "FR")).toBe("393401234567");
    expect(whatsAppDigits("393401234567", "IT")).toBe("393401234567");
    expect(whatsAppDigits("06 12 34 56 78", "FR")).toBe("33612345678");
    expect(whatsAppDigits("12", "IT")).toBe("");
    expect(whatsAppDigits(undefined)).toBe("");
    expect(whatsAppUrl("ciao & a presto", "340 1234567")).toBe("https://wa.me/393401234567?text=ciao%20%26%20a%20presto");
    expect(whatsAppUrl("x")).toBe("https://wa.me/?text=x");
  });
});

describe("html export", () => {
  test("standalone, escaped, with the drawing inline", () => {
    const html = buildHtml(model("it", { notes: "<script>alert(1)</script>" }, true));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<svg");
    expect(html).toContain("Acme Serramenti");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("TOTALE CHIAVI IN MANO");
  });
});

describe("backup", () => {
  test("round-trips pieces and client data", () => {
    const items = [defaultItem(payload, "finestra1"), defaultItem(payload, "porta2")];
    const back = parseBackup(buildBackup(items, { clientName: "Mario" }));
    expect(back?.items).toHaveLength(2);
    expect(back?.meta.clientName).toBe("Mario");
    expect(back?.skipped).toBe(0);
  });

  test("invalid pieces are skipped, foreign or newer files are refused", () => {
    const good = defaultItem(payload, "finestra1");
    const text = JSON.stringify({ format: "onespec-quote-draft", version: 1, items: [good, { ...good, width: 50 }, "junk"] });
    const back = parseBackup(text);
    expect(back?.items).toHaveLength(1);
    expect(back?.skipped).toBe(2);
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ format: "other", items: [] }))).toBeNull();
    expect(parseBackup(JSON.stringify({ format: "onespec-quote-draft", version: 99, items: [] }))).toBeNull();
    expect(parseBackup(JSON.stringify([good]))?.items).toHaveLength(1);
  });
});
