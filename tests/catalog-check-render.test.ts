// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import it_ from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";
import { STANDARD_PROFILES } from "../src/shared/standard-pricing";
import { glazingPackageRows } from "../src/shared/glazing-packages";

vi.mock("convex/react", () => ({ useMutation: () => async () => ({}) }));
vi.mock("@/components/configurator/catalog/store", () => ({
  useCatalogEditor: () => ({ configuratorId: "c1", busy: null, run: async () => undefined, labelOf: (l: Record<string, string>) => l?.it ?? "" }),
}));

import { CatalogCheck } from "../src/components/configurator/catalog/catalog-check";

const materials = [{ key: "pvc", labels: { it: "PVC" }, enabled: true, sortOrder: 0 }];
const tier = (key: string, sortOrder: number, enabled = true) => ({ materialKey: "pvc", key, labels: { it: key }, enabled, sortOrder });
const glazing = glazingPackageRows().map((r, i) => ({ key: r.key, labels: { it: r.key }, enabled: true, sortOrder: i }));
const standard = STANDARD_PROFILES.map((sp, i) => ({ materialKey: "pvc", key: sp.key, labels: { it: sp.name }, standardKey: sp.key, enabled: true, sortOrder: i }));

const render = (locale: string, messages: unknown, props: Record<string, unknown>) =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: messages as never, children: h(CatalogCheck as never, props as never) }));

describe("catalogue check panel", () => {
  it("an old catalogue (profiles without quality, no 6-chamber tier) offers the one-click update", () => {
    const html = render("it", it_, { materials, qualityTiers: [tier("chamber5", 0), tier("chamber7", 1)], profileSystems: standard, glazing });
    expect(html).toContain("Aggiorna catalogo");
    expect(html).toContain("non viene cambiato nessun prezzo");
    expect(html).not.toContain("Tutto in ordine");
  });

  it("a fully classified catalogue says everything is in order", () => {
    const tiers = [tier("chamber5", 0), tier("chamber6", 1), tier("chamber7", 2)];
    const rows = standard.map((p, i) => ({ ...p, qualityKey: `chamber${STANDARD_PROFILES[i].chambers}` }));
    const html = render("it", it_, { materials, qualityTiers: tiers, profileSystems: rows, glazing });
    expect(html).toContain("Tutto in ordine");
    expect(html).not.toContain("Aggiorna catalogo");
  });

  it("reports a hand-made profile and a profile whose quality is switched off", () => {
    const tiers = [tier("chamber5", 0), tier("chamber6", 1, false), tier("chamber7", 2)];
    const rows = [
      ...standard.map((p, i) => ({ ...p, qualityKey: `chamber${STANDARD_PROFILES[i].chambers}` })),
      { materialKey: "pvc", key: "mio", labels: { it: "Mio profilo" }, enabled: true, sortOrder: 99 },
    ];
    const html = render("it", it_, { materials, qualityTiers: tiers, profileSystems: rows, glazing });
    expect(html).toContain("«Mio profilo» non è classificato");
    expect(html).toContain("disattivata o non esiste");
  });

  it("a quality with no profile linked is reported when every profile is classified", () => {
    const tiers = [tier("chamber5", 0), tier("chamber6", 1), tier("chamber7", 2), tier("chamber8", 3)];
    const rows = standard.map((p, i) => ({ ...p, qualityKey: `chamber${STANDARD_PROFILES[i].chambers}` }));
    const html = render("it", it_, { materials, qualityTiers: tiers, profileSystems: rows, glazing });
    expect(html).toContain("la qualità «chamber8» non ha profili collegati");
  });

  it.each([["it", it_], ["en", en], ["fr", fr], ["de", de], ["nl", nl], ["ro", ro]] as const)("renders in %s without missing keys", (l, m) => {
    const html = render(l, m, { materials, qualityTiers: [tier("chamber5", 0)], profileSystems: standard, glazing });
    expect(html).not.toMatch(/editor\.catalog\.check/);
  });
});
