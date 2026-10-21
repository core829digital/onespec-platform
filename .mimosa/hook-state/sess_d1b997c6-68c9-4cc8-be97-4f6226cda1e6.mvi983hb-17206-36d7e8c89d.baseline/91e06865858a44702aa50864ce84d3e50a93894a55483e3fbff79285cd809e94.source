"use client";

import { createContext, useContext } from "react";

export interface DemoContextValue {
  /** Start again from the original data. */
  reset: () => void;
  /** Id of the demo company (so a page can tell "this is the demo"). */
  tenantId: string;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

/** The demo's controls, or null on the real platform. */
export function useDemo(): DemoContextValue | null {
  return useContext(DemoContext);
}
