/**
 * Professional grades (gradi) of a team member, and what each one may do.
 *
 * Two layers, deliberately kept apart:
 *  - the ACCESS TIER of a member (owner / admin / member, `memberships.role`) decides who can manage the company, the team, the catalogue and the billing;
 *  - the GRADE (this file) decides which AREAS of the platform a member works in: a fitter does not need the quotes' prices or the profit,
 *    a salesperson does not run the warehouse, the accountant does not draw the windows.
 * The grade only ever NARROWS what the tier allows (the owner is never narrowed; a member without a grade — everyone who joined before grades
 * existed — keeps full member access). One file feeds the server (convex/lib/rbac.ts) and the menu, so what is hidden is also refused.
 */

/** Areas of the platform, each a family of permissions (see `PERMISSION_GROUP`). */
export type PermissionGroup = "commercial" | "field" | "logistics" | "supply";

/** Where the grade belongs, for grouping in the invite form. */
export type GradeFamily = "management" | "technical" | "sales" | "operations" | "office";

export interface GradeSpec {
  key: string;
  family: GradeFamily;
  /** The access tier the grade comes with. */
  tier: "admin" | "member";
  /** The areas this grade works in. */
  groups: readonly PermissionGroup[];
}

const ALL: readonly PermissionGroup[] = ["commercial", "field", "logistics", "supply"];

export const GRADES = [
  // Direzione
  { key: "contitolare", family: "management", tier: "admin", groups: ALL },
  { key: "direttore_tecnico", family: "management", tier: "admin", groups: ALL },
  { key: "responsabile_commerciale", family: "management", tier: "admin", groups: ["commercial", "field", "logistics", "supply"] },
  { key: "responsabile_showroom", family: "management", tier: "admin", groups: ["commercial", "field", "supply"] },
  { key: "capocantiere", family: "management", tier: "member", groups: ["field", "logistics"] },
  // Tecnici e progettisti
  { key: "architetto", family: "technical", tier: "member", groups: ["commercial", "field"] },
  { key: "ingegnere", family: "technical", tier: "member", groups: ["commercial", "field"] },
  { key: "geometra", family: "technical", tier: "member", groups: ["commercial", "field"] },
  { key: "progettista", family: "technical", tier: "member", groups: ["commercial", "field"] },
  { key: "direttore_lavori", family: "technical", tier: "member", groups: ["commercial", "field", "logistics"] },
  { key: "rilevatore", family: "technical", tier: "member", groups: ["field"] },
  // Vendite e showroom
  { key: "venditore", family: "sales", tier: "member", groups: ["commercial", "field"] },
  { key: "agente_commerciale", family: "sales", tier: "member", groups: ["commercial"] },
  { key: "consulente_showroom", family: "sales", tier: "member", groups: ["commercial", "field"] },
  { key: "interior_designer", family: "sales", tier: "member", groups: ["commercial", "field"] },
  // Operativi: posa, magazzino, trasporti
  { key: "capo_squadra", family: "operations", tier: "member", groups: ["field", "logistics"] },
  { key: "montatore", family: "operations", tier: "member", groups: ["field"] },
  { key: "assistente_cantiere", family: "operations", tier: "member", groups: ["field"] },
  { key: "magazziniere", family: "operations", tier: "member", groups: ["logistics"] },
  { key: "autista", family: "operations", tier: "member", groups: ["logistics"] },
  // Ufficio
  { key: "amministrazione", family: "office", tier: "member", groups: ["commercial", "supply"] },
  { key: "segreteria", family: "office", tier: "member", groups: ["commercial", "field"] },
  { key: "acquisti", family: "office", tier: "member", groups: ["supply", "logistics"] },
  { key: "assistenza_clienti", family: "office", tier: "member", groups: ["commercial", "field"] },
] as const satisfies readonly GradeSpec[];

export type GradeKey = (typeof GRADES)[number]["key"];
export const GRADE_KEYS = GRADES.map((g) => g.key) as GradeKey[];
export const GRADE_FAMILIES: GradeFamily[] = ["management", "technical", "sales", "operations", "office"];

const BY_KEY = new Map<string, GradeSpec>(GRADES.map((g) => [g.key, g]));

export function isGradeKey(value: unknown): value is GradeKey {
  return typeof value === "string" && BY_KEY.has(value);
}

export function gradeSpec(grade: string | null | undefined): GradeSpec | undefined {
  return grade ? BY_KEY.get(grade) : undefined;
}

/** The access tier a grade comes with (member when there is no grade). */
export function gradeTier(grade: string | null | undefined): "admin" | "member" {
  return gradeSpec(grade)?.tier ?? "member";
}

/**
 * Which area each permission belongs to. Permissions that are not listed (company settings, team, billing, catalogue, branding…) are
 * decided by the access tier alone: the grade does not narrow them.
 */
export const PERMISSION_GROUP: Record<string, PermissionGroup> = {
  "quotes.use": "commercial",
  "quotes.field": "commercial",
  "quotes.manage": "commercial",
  "clients.use": "commercial",
  "clients.delete": "commercial",
  "cantieri.use": "field",
  "cantieri.delete": "field",
  "surveys.use": "field",
  "surveys.delete": "field",
  "inspections.use": "field",
  "inspections.delete": "field",
  "installations.use": "field",
  "installations.delete": "field",
  "passports.use": "field",
  "passports.manage": "field",
  "logistics.use": "logistics",
  "logistics.manage": "logistics",
  "supply.use": "supply",
  "supply.manage": "supply",
};

/** Whether a member with this grade may do this action. No grade (older members) and unlisted permissions are not narrowed. */
export function gradeAllows(grade: string | null | undefined, permission: string): boolean {
  const spec = gradeSpec(grade);
  if (!spec) return true;
  const group = PERMISSION_GROUP[permission];
  return group === undefined || spec.groups.includes(group);
}

/** Whether a member with this grade works in the given area (the menu uses it to show only what the member can use). */
export function gradeHasGroup(grade: string | null | undefined, group: PermissionGroup): boolean {
  const spec = gradeSpec(grade);
  return !spec || spec.groups.includes(group);
}
