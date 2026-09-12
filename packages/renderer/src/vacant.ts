import type { GridPoint } from "./coordinate-mapper";

export type GridAABB = {
  minRow: number;
  minCol: number;
  maxRow: number;
  maxCol: number;
};

/**
 * Unique walkable nodes. Pass the *starting* occupancy so lattice dots persist
 * after arrows leave; empty cells of the original mask keep their dots.
 */
export function occupiedCells(occupied: Iterable<GridPoint>): GridPoint[] {
  const seen = new Set<string>();
  const out: GridPoint[] = [];
  for (const cell of occupied) {
    const key = `${cell.row},${cell.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ row: cell.row, col: cell.col });
  }
  return out;
}

export function occupiedBounds(cells: Iterable<GridPoint>): GridAABB | null {
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  let any = false;
  for (const cell of cells) {
    any = true;
    minRow = Math.min(minRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxRow = Math.max(maxRow, cell.row);
    maxCol = Math.max(maxCol, cell.col);
  }
  if (!any) return null;
  return { minRow, minCol, maxRow, maxCol };
}

/** Starting lattice / mask — same unique-cell list, named for persistence. */
export function latticeCells(initial: Iterable<GridPoint>): GridPoint[] {
  return occupiedCells(initial);
}

export function boardBounds(width: number, height: number): GridAABB {
  return {
    minRow: 0,
    minCol: 0,
    maxRow: Math.max(0, height - 1),
    maxCol: Math.max(0, width - 1),
  };
}
