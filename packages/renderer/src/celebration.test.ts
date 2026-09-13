import { describe, expect, it } from "vitest";
import {
  RIPPLE_PULSE_S,
  RIPPLE_SPEED_PX_S,
  TAP_CONFETTI_COUNT,
  TAP_FX_MS,
  TAP_SPEED_SCALE,
  WIN_CONFETTI_COUNT,
  WIN_FX_MS,
  latticeRipple,
  rippleDelaySec,
  seedConfetti,
  seedTapConfetti,
} from "./celebration";

function tAt(sec: number): number {
  return sec / (WIN_FX_MS / 1000);
}

function peakT(distPx: number): number {
  return tAt(rippleDelaySec(distPx) + RIPPLE_PULSE_S / 2);
}

describe("celebration", () => {
  it("seeds original-palette confetti from the origin", () => {
    const bits = seedConfetti({ x: 40, y: 80 }, 12, 7);
    expect(bits).toHaveLength(12);
    expect(bits.every((b) => Math.hypot(b.x - 40, b.y - 80) < 16)).toBe(true);
    expect(new Set(bits.map((b) => b.color)).size).toBeGreaterThan(1);
    expect(new Set(bits.map((b) => b.delay)).size).toBe(3);
  });

  it("seeds a smaller single-burst tap blast", () => {
    const origin = { x: 10, y: 20 };
    const win = seedConfetti(origin);
    const bits = seedTapConfetti(origin, 3);
    expect(win).toHaveLength(WIN_CONFETTI_COUNT);
    expect(new Set(win.map((b) => b.delay)).size).toBe(3);
    expect(bits).toHaveLength(TAP_CONFETTI_COUNT);
    expect(TAP_CONFETTI_COUNT).toBe(36);
    expect(bits.length).toBeLessThan(win.length);
    expect(bits.every((b) => b.delay === 0 && b.x === 10 && b.y === 20)).toBe(true);

    const sameSeed = seedConfetti(origin, 12, 7, { bursts: 1, spread: 0, speedScale: 1 });
    const scaled = seedConfetti(origin, 12, 7, {
      bursts: 1,
      spread: 0,
      speedScale: TAP_SPEED_SCALE,
    });
    expect(TAP_FX_MS).toBe(WIN_FX_MS);
    expect(TAP_SPEED_SCALE).toBe(1.2);
    for (let i = 0; i < sameSeed.length; i++) {
      expect(Math.hypot(scaled[i].vx, scaled[i].vy)).toBeCloseTo(
        Math.hypot(sameSeed[i].vx, sameSeed[i].vy) * TAP_SPEED_SCALE,
        5,
      );
    }
  });

  it("delays each lattice pulse by distance / constant speed", () => {
    const origin = { x: 0, y: 0 };
    expect(rippleDelaySec(230)).toBeCloseTo(1, 5);
    expect(rippleDelaySec(460)).toBeCloseTo(2 * rippleDelaySec(230), 5);

    const nearDist = 80;
    const farDist = 320;
    const whenNearPeaks = peakT(nearDist);
    const near = latticeRipple(origin, { x: nearDist, y: 0 }, whenNearPeaks, 2);
    const farStillWaiting = latticeRipple(origin, { x: farDist, y: 0 }, whenNearPeaks, 2);
    expect(near.r).toBeGreaterThan(2);
    expect(farStillWaiting.r).toBeCloseTo(2);

    const far = latticeRipple(origin, { x: farDist, y: 0 }, peakT(farDist), 2);
    expect(far.r).toBeGreaterThan(2);

    const lateDumpT = 0.62;
    const lateElapsed = lateDumpT * (WIN_FX_MS / 1000);
    const waitingDist = RIPPLE_SPEED_PX_S * (lateElapsed + 0.4);
    const notDumped = latticeRipple(origin, { x: waitingDist, y: 0 }, lateDumpT, 2);
    expect(notDumped.r).toBeCloseTo(2);
  });
});
