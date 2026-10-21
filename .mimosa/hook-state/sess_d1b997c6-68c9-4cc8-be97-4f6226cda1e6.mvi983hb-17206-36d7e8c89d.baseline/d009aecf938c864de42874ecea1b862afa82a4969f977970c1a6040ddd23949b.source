"use client";

import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";

/** true / false once known, undefined while loading. Admin-only queries pass "skip" unless this is true (they would throw NOT_PLATFORM_ADMIN). */
export function useIsPlatformAdmin(): boolean | undefined {
  const viewer = useQuery(api.users.viewer);
  return viewer === undefined ? undefined : viewer?.isPlatformAdmin === true;
}
