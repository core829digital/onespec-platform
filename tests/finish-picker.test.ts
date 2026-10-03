// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { availableTabs, filterFinishes, groupsIn, swatchStyle, tabForKey, type PickerFinish } from "@/shared/finish-picker";
import { FinishPicker } from "@/components/quotes/editor/finish-picker";
import { WidgetFinishPicker } from "@/components/widget/widget-finish-picker";
import { finishLabels, FINISH_LIBRARY } from "@/shared/finish-library";
import it_ from "../messages/it.json";

const lib: PickerFinish[] = [
  { key: "white", label: "Bianco", hex: "#FFFFFF" },
  { key: "anthracite", label: "Antracite", hex: "#383E42" },
  ...FINISH_LIBRARY.map((f) => ({ key: f.id, label: finishLabels(f).it, hex: f.hex, texture: f.texture, range: f.range, group: f.group, warrantyYears: f.warranty })),
];

describe("finish picker logic", () => {
  it("offers the tabs that have finishes, in order", () => {
    expect(availableTabs(lib)).toEqual(["base", "skin", "nuance", "rock"]);
    expect(availableTabs(lib.slice(0, 2))).toEqual(["base"]);
    expect(availableTabs([])).toEqual([]);
  });

  it("lists the groups of a tab and filters by group and search", () => {
    expect(groupsIn(lib, "skin")).toEqual(expect.arrayContaining(["plain", "metallic", "wood"]));
    expect(groupsIn(lib, "base")).toEqual([]);
    expect(filterFinishes(lib, "skin", "wood", "").every((f) => f.group === "wood")).toBe(true);
    expect(filterFinishes(lib, "nuance", "", "7016").map((f) => f.key)).toEqual(["ral-7016"]);
    expect(filterFinishes(lib, "nuance", "", "BLU").every((f) => f.label.toLowerCase().includes("blu") || f.key.includes("blu"))).toBe(true);
    expect(filterFinishes(lib, "base", "", "").map((f) => f.key)).toEqual(["white", "anthracite"]);
    expect(filterFinishes(lib, "rock", "", "zzz")).toEqual([]);
  });

  it("swatches show the texture when there is one, else the flat colour; keys find their tab", () => {
    expect(swatchStyle({ hex: "#112233" }).background).toBe("#112233");
    expect(swatchStyle({ hex: "#112233", texture: "/finishes/s01.jpg" }).background).toContain("url(/finishes/s01.jpg)");
    expect(swatchStyle({}).background).toBe("#CCCCCC");
    expect(tabForKey(lib, "s54")).toBe("skin");
    expect(tabForKey(lib, "ral-1000")).toBe("nuance");
    expect(tabForKey(lib, "white")).toBe("base");
    expect(tabForKey(lib, "unknown")).toBe("base");
  });
});

describe("finish picker UI (server render)", () => {
  it("platform: shows the current swatch and label, closed by default", () => {
    const html = renderToStaticMarkup(
      h(NextIntlClientProvider, { locale: "it", messages: it_ as never, children: h(FinishPicker, { idBase: "p0", value: "s54", finishes: lib, onChange: () => {}, labelClass: "l" }) }),
    );
    expect(html).toContain("Mountain Pine");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("/finishes/s54.jpg");
    expect(html).not.toContain('role="radiogroup"');
  });

  it("widget: a catalogue without library rows keeps the plain select", () => {
    const html = renderToStaticMarkup(
      h(WidgetFinishPicker, {
        id: "c",
        lang: "it",
        value: "white",
        pairs: [["white", "Bianco"], ["ral", "RAL"]],
        meta: {},
        text: { finish: "f", base: "b", all: "a", search: "s", none: "n", warranty: "{years}" },
        onChange: () => {},
        styles: { select: {}, hint: {} },
      }),
    );
    expect(html).toContain("<select");
    expect(html).toContain("Bianco");
  });

  it("widget: a catalogue with the library shows the swatch button", () => {
    const meta = Object.fromEntries(lib.map((f) => [f.key, { hex: f.hex, range: f.range, group: f.group, ...(f.texture ? { texture: { href: f.texture, w: 160, h: 226 } } : {}) }]));
    const html = renderToStaticMarkup(
      h(WidgetFinishPicker, {
        id: "c",
        lang: "it",
        value: "s54",
        pairs: lib.map((f) => [f.key, f.label] as [string, string]),
        meta,
        text: { finish: "f", base: "b", all: "a", search: "s", none: "n", warranty: "{years}" },
        onChange: () => {},
        styles: { select: {}, hint: {} },
      }),
    );
    expect(html).toContain("<button");
    expect(html).toContain("Mountain Pine");
    expect(html).toContain('aria-expanded="false"');
  });
});
