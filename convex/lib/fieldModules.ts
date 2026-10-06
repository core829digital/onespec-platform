/** Shared helpers for the Phase C B2B field modules. */

import { analyzePng, pngBytesFromDataUrl } from "./png";
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

/** At least this many dark pixels, and a mark at least this wide/tall, for a picture to count as a signature (the pad saves 720 px wide). */
const MIN_INK_PIXELS = 120;
const MIN_INK_EXTENT = 20;

/**
 * Validate a signature picture: a base64 PNG data URL that actually has a pen stroke on it.
 * A blank page, a transparent image or a white-on-white line (what a pad that failed to draw produces) is refused with
 * SIGNATURE_EMPTY instead of being stored as "signed"; anything that is not a readable PNG is INVALID_SIGNATURE.
 */
export function assertSignature(dataUrl: string): void {
  if (dataUrl.length > SIGNATURE_MAX_LEN) throw new ConvexError("SIGNATURE_TOO_LARGE");
  const bytes = pngBytesFromDataUrl(dataUrl);
  if (!bytes) throw new ConvexError("INVALID_SIGNATURE");
  let ink;
  try {
    ink = analyzePng(bytes);
  } catch {
    throw new ConvexError("INVALID_SIGNATURE");
  }
  if (ink.inkPixels < MIN_INK_PIXELS || Math.max(ink.inkWidth, ink.inkHeight) < MIN_INK_EXTENT) throw new ConvexError("SIGNATURE_EMPTY");
}
