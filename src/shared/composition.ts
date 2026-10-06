/**
 * Pieces that are joined to each other to close a shape (an L-shaped bay, a window wall, a door with its side lights).
 * Each piece names the assembly it belongs to (`group`) and its cell on a small grid (`col` to the right, `row` downwards).
 * Pieces in one row share their height and pieces in one column share their width, so every shared edge lines up; the cells of
 * an assembly touch, so the shape is closed. Drawing, pricing and validation all read this one description.
 */

export const MAX_ASSEMBLY_GROUPS = 4;
export const MAX_ASSEMBLY_COLS = 4;
export const MAX_ASSEMBLY_ROWS = 4;
export const MAX_ASSEMBLY_PIECES = 6;

export interface Placement {
  /** Assembly number, 1..MAX_ASSEMBLY_GROUPS. */
  group: number;
  col: number;
  row: number;
}

export interface AssemblyPiece {
  width: number;
  height: number;
  composition?: Placement;
}

export interface AssemblyMember {
  index: number;
  col: number;
  row: number;
}

export type AssemblyIssue =
  | { code: "cellTaken"; group: number; col: number; row: number }
  | { code: "notConnected"; group: number }
  | { code: "rowHeight"; group: number; row: number }
  | { code: "colWidth"; group: number; col: number }
  | { code: "tooMany"; group: number }
  | { code: "outOfGrid"; group: number };

/** The valid placement of a piece, or undefined (absent or out of range). */
export function placementOf(piece: Pick<AssemblyPiece, "composition">): Placement | undefined {
  const c = piece.composition;
  if (!c) return undefined;
  const ok =
    Number.isInteger(c.group) && c.group >= 1 && c.group <= MAX_ASSEMBLY_GROUPS &&
    Number.isInteger(c.col) && c.col >= 0 && c.col < MAX_ASSEMBLY_COLS &&
    Number.isInteger(c.row) && c.row >= 0 && c.row < MAX_ASSEMBLY_ROWS;
  return ok ? c : undefined;
}

/** Assemblies of a lot, in group order, members in reading order (row, then column). Groups of a single piece are not assemblies. */
export function assemblyGroups(pieces: readonly AssemblyPiece[]): Array<{ group: number; members: AssemblyMember[] }> {
  const byGroup = new Map<number, AssemblyMember[]>();
  pieces.forEach((p, index) => {
    const c = placementOf(p);
    if (!c) return;
    const list = byGroup.get(c.group) ?? [];
    list.push({ index, col: c.col, row: c.row });
    byGroup.set(c.group, list);
  });
  return [...byGroup.entries()]
    .filter(([, m]) => m.length > 1)
    .sort((a, b) => a[0] - b[0])
    .map(([group, members]) => ({ group, members: members.sort((a, b) => a.row - b.row || a.col - b.col) }));
}

function connected(members: AssemblyMember[]): boolean {
  if (members.length <= 1) return true;
  const key = (c: number, r: number) => `${c},${r}`;
  const cells = new Set(members.map((m) => key(m.col, m.row)));
  const seen = new Set<string>([key(members[0].col, members[0].row)]);
  const queue = [members[0]];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = key(cur.col + dc, cur.row + dr);
      if (cells.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push({ index: -1, col: cur.col + dc, row: cur.row + dr });
      }
    }
  }
  return seen.size === cells.size;
}

/** Everything wrong with the assemblies of a lot. Empty means every assembly is a closed shape whose edges line up. */
export function assemblyIssues(pieces: readonly AssemblyPiece[]): AssemblyIssue[] {
  const issues: AssemblyIssue[] = [];
  // A piece with an invalid placement is reported once, with its group when it has one.
  pieces.forEach((p) => {
    if (p.composition && !placementOf(p)) issues.push({ code: "outOfGrid", group: p.composition.group });
  });
  const byGroup = new Map<number, AssemblyMember[]>();
  pieces.forEach((p, index) => {
    const c = placementOf(p);
    if (!c) return;
    byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), { index, col: c.col, row: c.row }]);
  });
  for (const [group, members] of [...byGroup.entries()].sort((a, b) => a[0] - b[0])) {
    if (members.length > MAX_ASSEMBLY_PIECES) issues.push({ code: "tooMany", group });
    const taken = new Set<string>();
    for (const m of members) {
      const k = `${m.col},${m.row}`;
      if (taken.has(k)) issues.push({ code: "cellTaken", group, col: m.col, row: m.row });
      taken.add(k);
    }
    if (members.length < 2) continue;
    if (!connected(members)) issues.push({ code: "notConnected", group });
    for (const row of new Set(members.map((m) => m.row))) {
      const heights = new Set(members.filter((m) => m.row === row).map((m) => pieces[m.index].height));
      if (heights.size > 1) issues.push({ code: "rowHeight", group, row });
    }
    for (const col of new Set(members.map((m) => m.col))) {
      const widths = new Set(members.filter((m) => m.col === col).map((m) => pieces[m.index].width));
      if (widths.size > 1) issues.push({ code: "colWidth", group, col });
    }
  }
  return issues;
}

export interface AssemblyLayout {
  /** Width of each column / height of each row, mm (index = col / row, from the first occupied one). */
  colsMm: number[];
  rowsMm: number[];
  /** Each member's box in mm from the top-left corner of the whole shape. */
  boxes: Array<{ index: number; x: number; y: number; w: number; h: number }>;
  totalWidthMm: number;
  totalHeightMm: number;
}

/** Where every piece of an assembly sits, in mm. Valid only when `assemblyIssues` is empty for it. */
export function assemblyLayout(pieces: readonly AssemblyPiece[], members: readonly AssemblyMember[]): AssemblyLayout {
  const minCol = Math.min(...members.map((m) => m.col));
  const maxCol = Math.max(...members.map((m) => m.col));
  const minRow = Math.min(...members.map((m) => m.row));
  const maxRow = Math.max(...members.map((m) => m.row));
  const colsMm: number[] = [];
  for (let c = minCol; c <= maxCol; c++) colsMm.push(Math.max(0, ...members.filter((m) => m.col === c).map((m) => pieces[m.index].width)));
  const rowsMm: number[] = [];
  for (let r = minRow; r <= maxRow; r++) rowsMm.push(Math.max(0, ...members.filter((m) => m.row === r).map((m) => pieces[m.index].height)));
  const sum = (a: number[], n: number) => a.slice(0, n).reduce((s, v) => s + v, 0);
  return {
    colsMm,
    rowsMm,
    boxes: members.map((m) => ({
      index: m.index,
      x: sum(colsMm, m.col - minCol),
      y: sum(rowsMm, m.row - minRow),
      w: pieces[m.index].width,
      h: pieces[m.index].height,
    })),
    totalWidthMm: sum(colsMm, colsMm.length),
    totalHeightMm: sum(rowsMm, rowsMm.length),
  };
}

/** The shared edges of an assembly: for each, the piece that pays for the coupling profile (the upper/left one) and its length in mm. */
export function assemblyJoins(pieces: readonly AssemblyPiece[], members: readonly AssemblyMember[]): Array<{ payer: number; other: number; lengthMm: number; axis: "vertical" | "horizontal" }> {
  const at = new Map(members.map((m) => [`${m.col},${m.row}`, m] as const));
  const out: Array<{ payer: number; other: number; lengthMm: number; axis: "vertical" | "horizontal" }> = [];
  for (const m of members) {
    const right = at.get(`${m.col + 1},${m.row}`);
    if (right) out.push({ payer: m.index, other: right.index, lengthMm: Math.min(pieces[m.index].height, pieces[right.index].height), axis: "vertical" });
    const below = at.get(`${m.col},${m.row + 1}`);
    if (below) out.push({ payer: m.index, other: below.index, lengthMm: Math.min(pieces[m.index].width, pieces[below.index].width), axis: "horizontal" });
  }
  return out;
}
