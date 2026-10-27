import { describe, expect, test } from "vitest";
import { catalogOptions } from "../src/components/widget/widget-catalog";
import { getDict } from "../src/components/widget/widget-i18n";
import { applyStateToItem, itemToState } from "../src/components/widget/item-render3d";
import { wizardWindow3D } from "../src/components/widget/wizard-render3d";
import { window3dFromState } from "../src/components/widget/widget-render3d";
import { buildWizardItem, type WizardSelection } from "../src/components/widget/simple-wizard-model";
import { buildWindow3D } from "../src/lib/render3d/window-3d";
import type { ProjectItem } from "../src/shared/pricing";

const options = catalogOptions(undefined, getDict("it"), "it-IT");

const item: ProjectItem = {
  productType: "window",
  material: "pvc",
  quality: { pvc: "chamber5" },
  profileSystem: "aluplast",
  width: 1400,
  height: 1500,
  quantity: 2,
  transoms: [900],
  composition: { group: 1, col: 0, row: 0 },
  sashes: [
    { type: "tiltturn", direction: "left", active: true, hardware: "maco", hardwareColor: "white", widthRatio: 0.5, main: true, transoms: [700] },
    { type: "tilt", direction: "right", active: true, hardware: "maco", hardwareColor: "white", widthRatio: 0.5 },
  ],
  glazing: "d24_floatBeArgon",
  color: "white",
  insectScreen: false,
  withInstallation: true,
  withDisposal: true,
  accessories: { cass: "deceuninck132", ctel: "lamiera" },
};

describe("piece (B2B quote editor / Showroom) -> 3D studio and back", () => {
  test("the piece is shown as it is, vasistas included, and builds a 3D window", () => {
    const state = itemToState(item, options);
    expect(state.width).toBe(1400);
    expect(state.sashes.map((s) => s.type)).toEqual(["tiltturn", "tilt"]);
    expect(state.cassonetto).toBe("deceuninck132");
    expect(state.controtelaio).toBe("lamiera");
    const model = window3dFromState(state, options, state.color);
    expect(model.sashes[1].type).toBe("tilt");
    const rig = buildWindow3D(model);
    expect(rig.hitTargets.length).toBeGreaterThan(0);
    rig.dispose();
  });

  test("writing an unchanged state back leaves the piece as it was", () => {
    const back = applyStateToItem(item, itemToState(item, options), true);
    expect(back.sashes[0].transoms).toEqual([700]);
    expect(back.sashes[1].type).toBe("tilt");
    expect(back.sashes[0].main).toBe(true);
    expect(back.transoms).toEqual([900]);
    expect(back.composition).toEqual(item.composition);
    expect(back.withInstallation).toBe(true);
    expect(back.withDisposal).toBe(true);
    expect(back.quantity).toBe(2);
    expect(back.accessories).toEqual({ cass: "deceuninck132", ctel: "lamiera" });
  });

  test("what the studio changes lands on the piece; what it does not touch stays", () => {
    const state = itemToState(item, options);
    const next = { ...state, color: "woodgrain", colorInside: "white", avvolgibile: "sovrapposto", cassonetto: "", insectScreen: true, insectScreenType: "pleated" };
    const back = applyStateToItem(item, next, true);
    expect(back.color).toBe("woodgrain");
    expect(back.colorInside).toBe("white");
    expect(back.accessories).toEqual({ avv: "sovrapposto", ctel: "lamiera" });
    expect(back.insectScreen).toBe(true);
    expect(back.insectScreenType).toBe("pleated");
    // Bicolour only where the catalogue sells it.
    expect(applyStateToItem(item, next, false).colorInside).toBeUndefined();
  });

  test("a different number of leaves drops the per-leaf bars (the layout changed) and keeps the piece's own", () => {
    const state = itemToState(item, options);
    const three = { ...state, sashes: [...state.sashes, { ...state.sashes[0], type: "fix" as const }].map((s) => ({ ...s, widthRatio: 1 / 3 })) };
    const back = applyStateToItem(item, three, true);
    expect(back.sashes).toHaveLength(3);
    expect(back.sashes[0].transoms).toBeUndefined();
    expect(back.transoms).toEqual([900]);
  });
});

describe("simple wizard -> 3D preview", () => {
  const sel: WizardSelection = { work: "renovation", product: "scorrevole", widthCm: "240", heightCm: "220", colour: "woodgrain", colourInside: "", glazing: "triple", frame: "straight", disposal: false, installation: true, incentive: "", postal: "" };

  test("the wizard's choices become the window of the preview", () => {
    const model = wizardWindow3D(buildWizardItem(sel, ""), "woodgrain");
    expect(model.widthMm).toBe(2400);
    expect(model.heightMm).toBe(2200);
    expect(model.door).toBe(true);
    expect(model.sashes.map((s) => s.type)).toEqual(["sliding", "sliding"]);
    expect(model.glass?.panes).toBe(3);
    expect(model.frameGrain).toBe(true);
    const rig = buildWindow3D(model);
    rig.dispose();
  });
});
