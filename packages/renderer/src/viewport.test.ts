import { describe, expect, it } from "vitest";
import { clampPan, clampZoom, FIT_VIEW, viewIsFit, ZOOM_MAX, ZOOM_MIN, zoomAround } from "./viewport";

const box = { x: 80, y: 120, w: 200, h: 160 };

describe("clampZoom", () => {
  it("limits zoom to 0.75×–2.5× of the fit scale", () => {
    expect(clampZoom(0.1)).toBeCloseTo(ZOOM_MIN);
    expect(clampZoom(9)).toBeCloseTo(ZOOM_MAX);
    expect(clampZoom(1.2)).toBeCloseTo(1.2);
    expect(clampZoom(0.1, 2)).toBeCloseTo(1.5);
    expect(clampZoom(9, 2)).toBeCloseTo(5);
  });
});

describe("clampPan", () => {
  it("keeps some of the content AABB on-screen when dragged far", () => {
    const dragged = clampPan({ scale: 2, panX: 4000, panY: -4000 }, 400, 700, box);
    const cx = 200;
    const cy = 350;
    const left = cx + (box.x - cx) * 2 + dragged.panX;
    const right = cx + (box.x + box.w - cx) * 2 + dragged.panX;
    const top = cy + (box.y - cy) * 2 + dragged.panY;
    const bottom = cy + (box.y + box.h - cy) * 2 + dragged.panY;
    expect(right).toBeGreaterThan(8);
    expect(left).toBeLessThan(400 - 8);
    expect(bottom).toBeGreaterThan(8);
    expect(top).toBeLessThan(700 - 8);
  });

  it("keeps a fit-scale pan instead of latching back to identity", () => {
    const next = clampPan({ scale: 1, panX: 40, panY: -30 }, 400, 700, box);
    expect(next.scale).toBeCloseTo(1);
    expect(next.panX).toBeCloseTo(40);
    expect(next.panY).toBeCloseTo(-30);
  });

  it("holds a tiny fitted board on-screen at 0.75×", () => {
    const tiny = { x: 160, y: 320, w: 80, h: 40 };
    const dragged = clampPan({ scale: 0.75, panX: -2000, panY: 2000 }, 400, 700, tiny);
    const cx = 200;
    const cy = 350;
    const left = cx + (tiny.x - cx) * 0.75 + dragged.panX;
    const right = cx + (tiny.x + tiny.w - cx) * 0.75 + dragged.panX;
    expect(right).toBeGreaterThan(8);
    expect(left).toBeLessThan(400 - 8);
  });
});

describe("zoomAround", () => {
  it("stays within the fit-relative zoom band", () => {
    const next = zoomAround(FIT_VIEW, 200, 350, 8, 400, 700, box);
    expect(next.scale).toBeLessThanOrEqual(ZOOM_MAX);
    expect(next.scale).toBeGreaterThanOrEqual(ZOOM_MIN);
  });
});

describe("viewIsFit", () => {
  it("treats identity as the initial fit", () => {
    expect(viewIsFit(FIT_VIEW)).toBe(true);
    expect(viewIsFit({ scale: 1.4, panX: 0, panY: 0 })).toBe(false);
  });
});
