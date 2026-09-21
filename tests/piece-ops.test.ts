import { describe, expect, test } from "vitest";
import { defaultSashesFor } from "../src/shared/configurator-model";
import {
  addSash,
  applyFrameToAll,
  blockingIssues,
  duplicateItem,
  electMain,
  moveItem,
  patchSash,
  pieceIssues,
  removeSash,
  resizeDivider,
  setCategory,
  setHeight,
} from "../src/shared/piece-ops";
import type { ProjectItem } from "../src/shared/pricing";

function piece(category: "finestra1" | "finestra2" | "finestra3" | "scorrevole" = "finestra2", over: Partial<ProjectItem> = {}): ProjectItem {
  const w = { finestra1: 900, finestra2: 1200, finestra3: 1800, scorrevole: 2500 }[category];
  const h = category === "scorrevole" ? 2100 : 1400;
  return {
    productType: category === "scorrevole" ? "balconyDoor" : "window",
    category,
    material: "pvc",
    quality: { pvc: "chamber5" },
    width: w,
    height: h,
    quantity: 1,
    sashes: defaultSashesFor(category, h),
    glazing: "double",
    color: "white",
    insectScreen: false,
    ...over,
  };
}

const ratioSum = (it: ProjectItem) => it.sashes.reduce((s, x) => s + (x.widthRatio ?? 0), 0);
const mains = (it: ProjectItem) => it.sashes.filter((s) => s.main).length;

describe("leaf operations", () => {
  test("adding and removing leaves keeps ratios at 1 and exactly one principale", () => {
    let it = piece("finestra2");
    it = addSash(it);
    expect(it.sashes).toHaveLength(3);
    expect(ratioSum(it)).toBeCloseTo(1, 6);
    expect(mains(it)).toBe(1);
    it = removeSash(it, 0);
    expect(it.sashes).toHaveLength(2);
    expect(ratioSum(it)).toBeCloseTo(1, 6);
    expect(mains(it)).toBe(1);
    expect(removeSash(piece("finestra1"), 0).sashes).toHaveLength(1);
  });

  test("a new leaf joins the sliding family when the frame slides, and the cap is 6 leaves", () => {
    const slid = addSash(piece("scorrevole"));
    expect(slid.sashes[slid.sashes.length - 1].type).toBe("sliding");
    let it = piece("finestra3");
    for (let i = 0; i < 6; i++) it = addSash(it);
    expect(it.sashes).toHaveLength(6);
  });

  test("marking a leaf principale clears the others; the tilt-turn is elected by default", () => {
    let it = piece("finestra2");
    expect(it.sashes.find((s) => s.main)?.type).toBe("tiltturn");
    it = patchSash(it, 0, { main: true });
    expect(it.sashes[0].main).toBe(true);
    expect(mains(it)).toBe(1);
    const noMain = electMain(piece("finestra2").sashes.map((s) => ({ ...s, main: false })));
    expect(noMain.filter((s) => s.main)).toHaveLength(1);
    expect(electMain([{ ...piece("finestra1").sashes[0], type: "fix" }]).every((s) => !s.main)).toBe(true);
  });

  test("divider drag rebalances two leaves and never crosses their minimum widths", () => {
    const it = piece("finestra2");
    const moved = resizeDivider(it, 0, 0.6);
    expect(moved.sashes[0].widthRatio).toBeCloseTo(0.6, 6);
    expect(ratioSum(moved)).toBeCloseTo(1, 6);
    const tooLeft = resizeDivider(it, 0, 0.01);
    expect((tooLeft.sashes[0].widthRatio ?? 0) * it.width).toBeGreaterThanOrEqual(300);
    const tooRight = resizeDivider(it, 0, 0.99);
    expect((tooRight.sashes[1].widthRatio ?? 0) * it.width).toBeGreaterThanOrEqual(415);
    expect(resizeDivider(it, 5, 0.5)).toBe(it);
  });

  test("changing the height keeps handles inside the slider range", () => {
    const it = setHeight(piece("finestra2"), 700);
    for (const s of it.sashes) {
      expect(s.handleHeightMm).toBeGreaterThanOrEqual(100);
      expect(s.handleHeightMm).toBeLessThanOrEqual(500);
    }
  });

  test("changing category rebuilds the leaves and the product family, keeping size and finishes", () => {
    const it = setCategory({ ...piece("finestra2"), color: "anthracite" }, "scorrevole", { hardware: "standard", hardwareColor: "black" });
    expect(it.productType).toBe("balconyDoor");
    expect(it.sashes.map((s) => s.type)).toEqual(["sliding", "fix"]);
    expect(it.sashes[0].hardwareColor).toBe("black");
    expect(it.color).toBe("anthracite");
    expect(it.width).toBe(1200);
  });
});

describe("lot operations", () => {
  test("telaio applies to the whole lot; duplicate is deep; move reorders", () => {
    const items = [piece("finestra1"), piece("finestra2")];
    expect(applyFrameToAll(items, "reno65").every((i) => i.frameType === "reno65")).toBe(true);
    const dup = duplicateItem(items, 0);
    expect(dup).toHaveLength(3);
    dup[1].sashes[0].direction = "right";
    expect(dup[0].sashes[0].direction).toBe("left");
    expect(moveItem(dup, 2, 0)[0]).toBe(dup[2]);
    expect(moveItem(dup, 0, 9)).toBe(dup);
  });
});

describe("validation", () => {
  test("hard problems block; leaf-width warnings do not", () => {
    expect(pieceIssues(piece("finestra2"))).toEqual([]);
    const tiny = pieceIssues(piece("finestra2", { width: 100 }));
    expect(tiny.some((i) => i.code === "size" && i.axis === "width")).toBe(true);
    expect(blockingIssues(tiny).length).toBeGreaterThan(0);

    const big = piece("finestra1", { width: 1500 });
    expect(pieceIssues(big).some((i) => i.code === "singleLeafMax")).toBe(true);

    const narrow = piece("finestra2", { width: 700 });
    const issues = pieceIssues(narrow);
    expect(issues.some((i) => i.code === "leafWidth")).toBe(true);
    expect(blockingIssues(issues).filter((i) => i.code === "leafWidth")).toHaveLength(0);
  });

  test("a hinged leaf next to a sliding one is flagged; a fixed leaf next to sliding is fine", () => {
    const mixed = piece("finestra2");
    mixed.sashes[0] = { ...mixed.sashes[0], type: "sliding" };
    expect(pieceIssues(mixed).some((i) => i.code === "mix")).toBe(true);
    expect(pieceIssues(piece("scorrevole")).some((i) => i.code === "mix")).toBe(false);
  });

  test("keys unknown to the catalogue are reported", () => {
    const payload = {
      materials: [{ key: "pvc", enabled: true }],
      qualityTiers: [{ materialKey: "pvc", key: "chamber5", enabled: true }],
      glazing: [{ key: "double", enabled: true }],
      finish: [{ key: "white", enabled: true }],
      frameTypes: [{ key: "dritto", enabled: true }],
    } as unknown as Parameters<typeof pieceIssues>[1];
    expect(pieceIssues(piece("finestra2"), payload)).toEqual([]);
    const bad = pieceIssues({ ...piece("finestra2"), material: "alu", color: "ral", frameType: "nope" }, payload);
    const fields = bad.filter((i) => i.code === "unknownKey").map((i) => (i as { field: string }).field);
    expect(fields).toEqual(expect.arrayContaining(["material", "color", "frameType"]));
  });
});
