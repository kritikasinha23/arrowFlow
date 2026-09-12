import { describe, expect, it } from "vitest";
import {
  blockedTravelCells,
  dist,
  headPointAtProgress,
  offBoardTravelCells,
  polylineLength,
  progressToVisiblePath,
  unweaveStopProgress,
} from "./index";

const rest = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

const restLen = polylineLength(rest);
const rightTravel = 20;

function isRigidTranslate(
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  eps = 1e-6,
): boolean {
  if (from.length !== to.length || from.length === 0) return false;
  const dx = to[0].x - from[0].x;
  const dy = to[0].y - from[0].y;
  return from.every(
    (p, i) => Math.abs(to[i].x - p.x - dx) < eps && Math.abs(to[i].y - p.y - dy) < eps,
  );
}

function isFourConnected(points: { x: number; y: number }[], eps = 1e-6): boolean {
  for (let i = 1; i < points.length; i++) {
    const ax = Math.abs(points[i].x - points[i - 1].x) <= eps;
    const ay = Math.abs(points[i].y - points[i - 1].y) <= eps;
    if (ax === ay) return false;
  }
  return points.length >= 2;
}

describe("progressToVisiblePath", () => {
  it("returns the rest polyline at progress 0", () => {
    expect(progressToVisiblePath(rest, 0, "right", rightTravel)).toEqual(rest);
  });

  it("keeps rest length L at mid-progress (no tip-grown laser)", () => {
    const a = progressToVisiblePath(rest, 0.2, "right", rightTravel);
    const b = progressToVisiblePath(rest, 0.5, "right", rightTravel);
    expect(polylineLength(a)).toBeCloseTo(restLen, 8);
    expect(polylineLength(b)).toBeCloseTo(restLen, 8);
    expect(polylineLength(b)).toBeLessThanOrEqual(restLen + 1e-6);
  });

  it("unweaves an L: mid-progress is not a rigid translate", () => {
    const vis = progressToVisiblePath(rest, 0.5, "right", rightTravel);
    expect(isRigidTranslate(rest, vis)).toBe(false);
    const head = vis[vis.length - 1];
    expect(head.x).toBeGreaterThan(rest[2].x);
    expect(head.y).toBeCloseTo(rest[2].y, 8);
    expect(isFourConnected(vis)).toBe(true);
    expect(vis[0]).toEqual({ x: 10, y: 0 });
    expect(vis.some((p) => Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y - 10) < 1e-6)).toBe(true);
  });

  it("slides a straight I like a translate along heading", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const vis = progressToVisiblePath(line, 0.4, "right", 30);
    expect(polylineLength(vis)).toBeCloseTo(20, 8);
    expect(vis[0].x).toBeCloseTo(12, 8);
    expect(vis[vis.length - 1].x).toBeCloseTo(32, 8);
    expect(vis[0].y).toBeCloseTo(0, 8);
    expect(vis[vis.length - 1].y).toBeCloseTo(0, 8);
  });

  it("does not grow a heading shaft from the original tip", () => {
    const vis = progressToVisiblePath(rest, 0.5, "down", 20);
    expect(polylineLength(vis)).toBeCloseTo(restLen, 8);
    expect(polylineLength(vis)).not.toBeGreaterThan(restLen + 1e-6);
  });
});

describe("headPointAtProgress", () => {
  it("keeps the original tip at rest (progress 0)", () => {
    expect(headPointAtProgress(rest, 0, "right", rightTravel)).toEqual({ x: 10, y: 10 });
  });

  it("moves the head in the heading direction at 0.2 and 0.6", () => {
    const h0 = headPointAtProgress(rest, 0, "right", rightTravel);
    const h02 = headPointAtProgress(rest, 0.2, "right", rightTravel);
    const h06 = headPointAtProgress(rest, 0.6, "right", rightTravel);
    expect(h02.x).toBeGreaterThan(h0.x);
    expect(h06.x).toBeGreaterThan(h02.x);
    expect(h02.y).toBeCloseTo(h0.y, 8);
    expect(h06.y).toBeCloseTo(h0.y, 8);
    expect(dist(h0, h02)).toBeCloseTo(0.2 * rightTravel, 8);
    expect(dist(h0, h06)).toBeCloseTo(0.6 * rightTravel, 8);
  });
});

describe("slide travel", () => {
  const cells = [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ];

  it("pulls a free thread until the whole window is off the AABB", () => {
    expect(offBoardTravelCells(cells, "right", 4, 4)).toBe(3);
    expect(offBoardTravelCells(cells, "left", 4, 4)).toBe(4);
    expect(offBoardTravelCells(cells, "up", 4, 4)).toBe(3);
    expect(offBoardTravelCells(cells, "down", 4, 4)).toBe(4);
  });

  it("uses occupied content bounds when the declared grid is larger", () => {
    expect(
      offBoardTravelCells(cells, "right", { minRow: 1, minCol: 1, maxRow: 1, maxCol: 2 }),
    ).toBe(2);
  });

  it("counts rest length plus heading clearance for an L", () => {
    const ell = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ];
    expect(offBoardTravelCells(ell, "right", 4, 4)).toBe(5);
  });

  it("stops a blocked tug just before the foreign cell", () => {
    expect(blockedTravelCells(0)).toBeCloseTo(0.82, 8);
    expect(blockedTravelCells(1)).toBeCloseTo(1.82, 8);
  });
});

describe("unweaveStopProgress", () => {
  it("runs free and blocked clocks to the end of their travel", () => {
    expect(unweaveStopProgress("free")).toBe(1);
    expect(unweaveStopProgress("blocked")).toBe(1);
  });
});
