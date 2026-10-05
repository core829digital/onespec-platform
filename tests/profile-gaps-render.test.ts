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

let gaps: unknown;
vi.mock("convex/react", () => ({ useQuery: () => gaps, useMutation: () => async () => ({}), useAction: () => async () => ({}) }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => h("a", { href, ...rest }, children as never) }));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => (e: unknown) => String(e) }));

import { ProfileGapsBanner } from "../src/components/app-shell/profile-gaps-banner";

const MSG = { it: it_, en, fr, de, nl, ro } as const;
const render = (locale: keyof typeof MSG = "it") =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: MSG[locale] as never, children: h(ProfileGapsBanner) }));

describe("profile gaps banner", () => {
  it("names what is missing and links to the company data page", () => {
    gaps = { missing: ["address", "tax"], canEdit: true };
    const html = render();
    expect(html).toContain("Completa i dati della tua azienda");
    expect(html).toContain("sede, fiscalità e IVA");
    expect(html).toContain("/app/account/company");
  });
  it("is silent when nothing is missing, while loading, for accounts still in the wizard, and for members who cannot edit", () => {
    for (const v of [{ missing: [], canEdit: true }, undefined, null, { missing: ["tax"], canEdit: false }]) {
      gaps = v;
      expect(render()).toBe("");
    }
  });
  it("exists in every language", () => {
    gaps = { missing: ["company", "address", "contact", "tax"], canEdit: true };
    for (const l of Object.keys(MSG) as (keyof typeof MSG)[]) {
      const html = render(l);
      expect(html).not.toContain("profileGaps.");
      expect(html.length).toBeGreaterThan(200);
    }
  });
});
