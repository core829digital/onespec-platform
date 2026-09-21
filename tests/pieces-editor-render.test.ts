// @vitest-environment node
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, test, vi } from "vitest";
import it from "../messages/it.json";
import en from "../messages/en.json";
import { PiecesEditor } from "../src/components/quotes/editor/pieces-editor";
import { DEFAULT_ACCESSORIES, DEFAULT_FRAME_TYPES } from "../src/shared/configurator-model";
import { defaultItem } from "../src/shared/item-defaults";
import type { CatalogPayload } from "../src/shared/pricing";

vi.mock("@/components/quotes/sash-panel", () => ({ SashPanel: () => null }));

const payload = {
  configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR" },
  branding: null,
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, uFrameBase: 1.3, sortOrder: 0, enabled: true }],
  qualityTiers: [{ materialKey: "pvc", key: "chamber5", labels: { it: "5 camere" }, multiplier: 1, uAdjust: 0, sortOrder: 0, enabled: true }],
  profileSystems: [
    { materialKey: "pvc", key: "aluplast", labels: { it: "Aluplast IDEAL 4000" }, multiplier: 1, uFrame: 1.3, group: "tab1", sortOrder: 0, enabled: true },
    { materialKey: "pvc", key: "rehau", labels: { it: "Rehau Synego" }, multiplier: 1.08, uFrame: 1, group: "tab2", sortOrder: 1, enabled: true },
  ],
  sizeConstraints: [],
  glazing: [{ key: "double", labels: { it: "Doppio" }, priceCents: 0, uGlass: 1.1, sortOrder: 0, enabled: true }],
  finish: [{ key: "white", labels: { it: "Bianco" }, swatchHex: "#fff", priceCents: 0, sortOrder: 0, enabled: true }],
  hardware: [
    { kind: "sashType", key: "fix", labels: { it: "Fisso" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
    { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 5000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "sashType", key: "classic", labels: { it: "Battente" }, priceCents: 3000, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
    { kind: "hardware", key: "standard", labels: { it: "Standard" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "hardwareColor", key: "silver", labels: { it: "Argento" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  ],
  frameTypes: DEFAULT_FRAME_TYPES,
  accessories: DEFAULT_ACCESSORIES,
  productBase: [],
} as unknown as CatalogPayload;

function render(locale: "it" | "en", items = [defaultItem(payload, "finestra2")]) {
  return renderToString(
    h(NextIntlClientProvider, { locale, messages: locale === "it" ? it : en, onError: () => undefined },
      h(PiecesEditor, { payload, locale, items, onChange: () => undefined, activeIndex: 0, onActiveChange: () => undefined })),
  ).replace(/<!-- -->/g, "");
}

test("the editor renders categories, telaio choices, the piece form and the drawing", () => {
  const html = render("it");
  expect(html).toContain("+ Finestra 2 ante");
  expect(html).toContain("Ristrutturazione 40mm");
  expect(html).toContain("Aluplast IDEAL 4000");
  expect(html).toContain("<svg");
  expect(html).toContain("Larghezza (mm)");
  expect(html).toContain("Uw ");
  expect(html).toContain("Pos. 1");
});

test("English labels, empty state and issues", () => {
  expect(render("en")).toContain("+ Window 2 sashes");
  const empty = render("it", []);
  expect(empty).toContain("Aggiungi un primo pezzo");
  const bad = render("it", [{ ...defaultItem(payload, "finestra1"), width: 100 }]);
  expect(bad).toContain("fuori limite");
});
