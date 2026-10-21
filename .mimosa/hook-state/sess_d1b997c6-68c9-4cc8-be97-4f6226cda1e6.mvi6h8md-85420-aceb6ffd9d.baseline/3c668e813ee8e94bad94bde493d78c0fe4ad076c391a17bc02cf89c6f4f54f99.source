"use client";

import { useQuery as convexUseQuery, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * `useQuery` from Convex, safe for server-rendered pages: while the page is hydrating it answers `undefined` (what the server rendered) and
 * subscribes right after. Without it a live answer that lands DURING hydration paints other markup than the server sent and React throws
 * error #418 (recoverable, but it flashes the page and fills the error log). Same API as `convex/react`'s `useQuery`.
 */
export function useQuery<Query extends FunctionReference<"query">>(query: Query, ...args: OptionalRestArgsOrSkip<Query>): FunctionReturnType<Query> | undefined {
  const hydrated = useHydrated();
  return convexUseQuery(query, ...((hydrated ? args : ["skip"]) as OptionalRestArgsOrSkip<Query>));
}
