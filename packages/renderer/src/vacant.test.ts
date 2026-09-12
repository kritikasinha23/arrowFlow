import { describe, expect, it } from "vitest";
import { latticeCells, occupiedBounds, occupiedCells } from "./vacant";

describe("occupiedCells / latticeCells", () => {
  it("keeps the starting lattice, including nodes that later become vacant", () => {
    const start = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ];
    const dots = latticeCells(start);
    expect(dots).toEqual(start);
    expect(dots).toHaveLength(3);
    expect(dots.some((c) => c.row === 0 && c.col === 0)).toBe(true);
  });

  it("does not invent a filled rectangle beyond the starting shape", () => {
    const dots = occupiedCells([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(dots).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(dots.some((c) => c.row === 1)).toBe(false);
  });

  it("dedupes overlapping occupancy", () => {
    expect(
      occupiedCells([
        { row: 2, col: 2 },
        { row: 2, col: 2 },
      ]),
    ).toEqual([{ row: 2, col: 2 }]);
  });
});

describe("occupiedBounds", () => {
  it("fits the occupied AABB, not a padded empty rectangle", () => {
    expect(
      occupiedBounds([
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ]),
    ).toEqual({ minRow: 1, minCol: 1, maxRow: 1, maxCol: 2 });
  });

  it("returns null when nothing remains", () => {
    expect(occupiedBounds([])).toBeNull();
  });
});
