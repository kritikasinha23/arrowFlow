import { describe, expect, it } from "vitest";
import { hashDots, headingRays, type RenderArrow, type RenderFrame } from "./board-renderer";

const start: RenderArrow[] = [
  {
    id: "A",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ],
    direction: "right",
    headCell: { row: 0, col: 1 },
    isRed: false,
  },
  {
    id: "B",
    cells: [
      { row: 1, col: 1 },
      { row: 2, col: 1 },
    ],
    direction: "down",
    headCell: { row: 2, col: 1 },
    isRed: false,
  },
];

const lattice = start.flatMap((a) => a.cells);

function frame(arrows: RenderArrow[], extra?: Partial<RenderFrame>): RenderFrame {
  return { boardW: 4, boardH: 4, arrows, lines: "on", lattice, ...extra };
}

describe("hashDots", () => {
  it("keeps starting lattice nodes after arrows leave", () => {
    const remaining = start.filter((a) => a.id === "A");
    const dots = hashDots(frame(remaining));
    expect(dots).toHaveLength(4);
    expect(dots.some((c) => c.row === 2 && c.col === 1)).toBe(true);
  });

  it("does not fill a rectangle beyond the starting shape", () => {
    const dots = hashDots(frame(start));
    expect(dots.some((c) => c.row === 0 && c.col === 2)).toBe(false);
    expect(dots.some((c) => c.row === 3 && c.col === 3)).toBe(false);
  });
});

describe("headingRays", () => {
  const packed: RenderArrow[] = [
    {
      id: "A",
      cells: [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
      direction: "right",
      headCell: { row: 1, col: 1 },
      isRed: false,
    },
    {
      id: "B",
      cells: [
        { row: 1, col: 2 },
        { row: 1, col: 3 },
      ],
      direction: "right",
      headCell: { row: 1, col: 3 },
      isRed: false,
    },
  ];

  it("clips each remaining arrow at the first foreign occupant", () => {
    const rays = headingRays(frame(packed));
    expect(rays).toHaveLength(2);
    expect(rays.find((r) => r.arrowId === "A")?.cells).toEqual([{ row: 1, col: 2 }]);
    expect(rays.find((r) => r.arrowId === "B")?.cells).toEqual([]);
  });

  it("runs a free ray to the board edge", () => {
    const open: RenderArrow[] = [
      {
        id: "A",
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        direction: "right",
        headCell: { row: 0, col: 1 },
        isRed: false,
      },
    ];
    const ray = headingRays(frame(open)).find((r) => r.arrowId === "A");
    expect(ray?.cells).toEqual([
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]);
  });

  it("accents selected or blocked-red pieces", () => {
    const red = packed.map((a) => (a.id === "A" ? { ...a, isRed: true } : a));
    expect(headingRays(frame(red)).find((r) => r.arrowId === "A")?.accent).toBe(true);
    expect(headingRays(frame(packed, { selectedId: "B" })).find((r) => r.arrowId === "B")?.accent).toBe(true);
    expect(headingRays(frame(packed)).find((r) => r.arrowId === "B")?.accent).toBe(false);
  });

  it("skips a hidden in-flight piece", () => {
    const rays = headingRays(frame(packed.map((a) => (a.id === "A" ? { ...a, hidden: true } : a))));
    expect(rays.map((r) => r.arrowId)).toEqual(["B"]);
  });
});
