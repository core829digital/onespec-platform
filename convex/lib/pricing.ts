import { internalQuery } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { calculatePrice, type ProjectItem } from "../../src/shared/pricing";
import { ProjectItemSchema } from "../../src/shared/widget-types";
import { calculateVAT } from "./regions";
import { regionForCountry } from "./regions";

export const recompute = internalQuery({
  args: { 
    configuratorId: v.id("configurators"), 
    catalogVersion: v.number(), 
    items: v.any(),
    regionCode: v.optional(v.string()),
    buildingAge: v.optional(v.number()),
    isEnergyRenovation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", args.configuratorId).eq("version", args.catalogVersion),
      )
      .unique();
    if (!version) throw new ConvexError("VERSION_NOT_FOUND");

    const rawItems = Array.isArray(args.items) ? args.items : [];
    const items: ProjectItem[] = rawItems.map((it: unknown) => {
      const parsed = ProjectItemSchema.safeParse(it);
      if (!parsed.success) throw new ConvexError("INVALID_ITEM");
      return parsed.data as ProjectItem;
    });
    if (items.length === 0) throw new ConvexError("NO_ITEMS");

    const baseCalc = calculatePrice(version.payload, items);
    
    // Add VAT breakdown if region info provided
    let vatBreakdown = null;
    if (args.regionCode) {
      const region = regionForCountry(args.regionCode);
      const regionCode = region.code as "IT" | "FR" | "BE" | "NL" | "DE" | "LU";
      
      // For IT, we need the split
      let itSplit = undefined;
      if (regionCode === "IT") {
        // Estimate split from baseCalc
        let manoperaCents = 0;
        let beniCents = 0;
        let altriCents = 0;
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const ib = baseCalc.items[i];
          if (!ib) continue;
          
          const installationCost = item.installation
            ? (version.payload.hardware.find((h: { kind: string; key: string; enabled: boolean; priceCents: number }) => h.kind === "installation" && h.key === item.installation && h.enabled)?.priceCents || 0)
            : 0;
          manoperaCents += installationCost * item.quantity;
          
          const materialCost = ib.materialCost + ib.profileCost;
          beniCents += materialCost * item.quantity;
          
          const optionsCost = ib.optionsCost - installationCost;
          altriCents += optionsCost * item.quantity;
        }
        
        itSplit = { manoperaCents, beniCents, altriCents };
      }
      
      vatBreakdown = calculateVAT({
        regionCode,
        subtotalExVatCents: baseCalc.priceExVatCents,
        isEnergyRenovation: args.isEnergyRenovation,
        buildingAge: args.buildingAge,
        itSplit,
      });
    }

    return {
      ...baseCalc,
      vatBreakdown,
    };
  },
});
