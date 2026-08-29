import { internalQuery } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { calculatePrice, type ProjectItem } from "../../src/shared/pricing";
import { ProjectItemSchema } from "../../src/shared/widget-types";

export const recompute = internalQuery({
  args: { configuratorId: v.id("configurators"), catalogVersion: v.number(), items: v.any() },
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

    return calculatePrice(version.payload, items);
  },
});
