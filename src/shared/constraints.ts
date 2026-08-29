import { CatalogPayload, ProjectItem } from "./pricing";

export interface SizeConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export function getSizeConstraints(
  payload: CatalogPayload,
  productType: "window" | "balconyDoor",
  sashCount: number
): SizeConstraints {
  const constraint = payload.sizeConstraints.find(
    c => c.productType === productType && c.sashCount === sashCount
  );

  if (constraint) {
    return {
      minWidth: constraint.minWidthMm,
      maxWidth: constraint.maxWidthMm,
      minHeight: constraint.minHeightMm,
      maxHeight: constraint.maxHeightMm,
    };
  }

  if (sashCount === 1) {
    return {
      minWidth: productType === "balconyDoor" ? 450 : 450,
      maxWidth: 1200,
      minHeight: productType === "balconyDoor" ? 1700 : 300,
      maxHeight: 2800,
    };
  }

  return {
    minWidth: productType === "balconyDoor" ? 600 : 600,
    maxWidth: 4000,
    minHeight: productType === "balconyDoor" ? 1700 : 300,
    maxHeight: 2800,
  };
}

export function getDefaultDimensions(productType: "window" | "balconyDoor"): { width: number; height: number } {
  return productType === "balconyDoor" ? { width: 900, height: 2100 } : { width: 1200, height: 1400 };
}

export function getDefaultConfigFields(): Omit<ProjectItem, "sashes"> & { sashes: ProjectItem["sashes"] } {
  return {
    productType: "window",
    material: "pvc",
    quality: { pvc: "chamber5", wood: "pine", aluminum: "standard" },
    width: 1200,
    height: 1400,
    quantity: 1,
    sashes: [
      { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
      { type: "fix", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
    ],
    selectedSash: null,
    glazing: "double",
    color: "white",
    insectScreen: false,
  };
}

export function validateItem(payload: CatalogPayload, item: ProjectItem): string[] {
  const errors: string[] = [];
  const constraints = getSizeConstraints(payload, item.productType, item.sashes.length);

  if (item.width < constraints.minWidth || item.width > constraints.maxWidth) {
    errors.push(`Width must be between ${constraints.minWidth} and ${constraints.maxWidth}mm`);
  }
  if (item.height < constraints.minHeight || item.height > constraints.maxHeight) {
    errors.push(`Height must be between ${constraints.minHeight} and ${constraints.maxHeight}mm`);
  }
  if (item.quantity < 1 || item.quantity > 50) {
    errors.push("Quantity must be between 1 and 50");
  }
  if (item.sashes.length < 1 || item.sashes.length > 4) {
    errors.push("Sash count must be between 1 and 4");
  }

  const material = payload.materials.find(m => m.key === item.material && m.enabled);
  if (!material) errors.push("Invalid material");

  const quality = payload.qualityTiers.find(q => q.materialKey === item.material && q.key === item.quality[item.material] && q.enabled);
  if (!quality) errors.push("Invalid quality tier");

  const glazing = payload.glazing.find(g => g.key === item.glazing && g.enabled);
  if (!glazing) errors.push("Invalid glazing option");

  const finish = payload.finish.find(f => f.key === item.color && f.enabled);
  if (!finish) errors.push("Invalid finish option");

  return errors;
}