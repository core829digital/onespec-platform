"use client";

import { useQuery as convexUseQuery, useQuery_experimental, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
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

export type QueryResult<T> = { status: "pending" } | { status: "success"; data: T } | { status: "error"; error: Error };

/**
 * Like `useQuery` above, but a query error becomes `{status:"error"}` instead of an exception thrown during render.
 * `useQuery`'s throw only works for callers that sit under an error boundary meant to lose the whole page; use this for
 * a query whose own caller means to show a local, friendly fallback instead (e.g. with `useFriendlyError`).
 */
export function useQueryResult<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): QueryResult<FunctionReturnType<Query>> {
  const hydrated = useHydrated();
  const requested = args[0] as FunctionArgs<Query> | "skip" | undefined;
  const effectiveArgs = (hydrated ? (requested ?? {}) : "skip") as FunctionArgs<Query> | "skip";
  return useQuery_experimental({ query, args: effectiveArgs });
}
