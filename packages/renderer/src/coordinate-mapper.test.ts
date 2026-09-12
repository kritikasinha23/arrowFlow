import { describe, expect, it } from "vitest";
import { CoordinateMapper } from "./coordinate-mapper";

describe("CoordinateMapper content fit", () => {
  it("sizes cells from the occupied AABB, not the declared W×H lattice", () => {
    const full = new CoordinateMapper(8, 8, 400, 700);
    const packed = new CoordinateMapper(8, 8, 400, 700, {
      content: { minRow: 0, minCol: 0, maxRow: 5, maxCol: 5 },
    });
    const strip = new CoordinateMapper(8, 8, 400, 700, {
      content: { minRow: 1, minCol: 1, maxRow: 1, maxCol: 2 },
    });
    expect(packed.cols).toBe(6);
    expect(packed.rows).toBe(6);
    expect(packed.cell).toBeGreaterThan(full.cell);
    expect(strip.cell).toBeGreaterThan(packed.cell);
    expect(strip.contentBox.w / strip.contentBox.h).toBeCloseTo(2, 5);
  });

  it("places occupied cell centers inside the fitted content box", () => {
    const mapper = new CoordinateMapper(4, 4, 400, 400, {
      content: { minRow: 1, minCol: 1, maxRow: 1, maxCol: 2 },
    });
    const a = mapper.cellCenter({ row: 1, col: 1 });
    const b = mapper.cellCenter({ row: 1, col: 2 });
    expect(a.x).toBeGreaterThan(mapper.contentBox.x);
    expect(b.x).toBeLessThan(mapper.contentBox.x + mapper.contentBox.w);
    expect(b.x - a.x).toBeCloseTo(mapper.cell, 5);
  });
});
