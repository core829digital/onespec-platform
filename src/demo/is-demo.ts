/**
 * The public demo of the whole platform lives on its own host (demo.<domain>): the same deployment, but every page runs against an
 * in-browser database (see src/demo/*). The host decides — there is no flag a visitor of the real platform can flip.
 */
export function isDemoHost(host: string | null | undefined): boolean {
  return typeof host === "string" && /^demo\./i.test(host.trim());
}
