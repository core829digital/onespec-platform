import { useConvexAuth } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * True when the "Invite and save" section applies to the signed-in member (programme on,
 * owner/admin of a paying account). Never throws and never queries before auth is ready.
 */
export function useReferralVisible(tenantId: Id<"tenants"> | undefined): boolean {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.referrals.referralNavVisible, tenantId && isAuthenticated ? { tenantId } : "skip") === true;
}
