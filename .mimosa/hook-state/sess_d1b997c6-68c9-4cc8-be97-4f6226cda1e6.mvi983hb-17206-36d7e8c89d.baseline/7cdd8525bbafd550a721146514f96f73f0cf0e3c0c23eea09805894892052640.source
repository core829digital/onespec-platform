"use client";

import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** How many of the caller's support tickets have a reply they have not read yet (0 while loading). */
export function useSupportUnread(tenantId: Id<"tenants"> | undefined): number {
  return useQuery(api.support.unreadCount, tenantId ? { tenantId } : "skip") ?? 0;
}
