/** Shared helpers for the Phase C B2B field modules. */

import { ConvexError } from "convex/values";
import type { ReadCtx } from "./auth";
import { requireTenantRole } from "./auth";
import { regionForCountry, type RegionCode } from "./regions";
import type { Id } from "../_generated/dataModel";

/** Resolve a tenant's market region code, after checking the caller's role. */
export async function requireTenantRegion(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
): Promise<{ userId: Id<"users">; regionCode: RegionCode }> {
  const { userId } = await requireTenantRole(ctx, tenantId, ["owner", "admin", "member"]);
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  return { userId, regionCode: regionForCountry(tenant.country).code };
}

/** Sum the perimeter (mm) of a list of rectangular openings. */
export function totalPerimeterMm(
  openings: { widthMm: number; heightMm: number }[],
): number {
  return openings.reduce(
    (sum, o) => sum + 2 * (Math.max(o.widthMm, 0) + Math.max(o.heightMm, 0)),
    0,
  );
}

const SIGNATURE_MAX_LEN = 200_000;

/** Validate a base64 PNG signature data URL. Throws on failure. */
export function assertSignature(dataUrl: string): void {
  if (!dataUrl.startsWith("data:image/")) throw new ConvexError("INVALID_SIGNATURE");
  if (dataUrl.length > SIGNATURE_MAX_LEN) throw new ConvexError("SIGNATURE_TOO_LARGE");
}
