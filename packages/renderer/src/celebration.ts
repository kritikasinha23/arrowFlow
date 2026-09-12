import type { Point } from "@arrowflow/twine";

export const WIN_FX_MS = 2400;
export const WIN_CARD_AFTER_MS = 560;
export const TAP_FX_MS = 500;
/** Level-clear party: three staggered bursts. */
export const WIN_CONFETTI_COUNT = 108;
/** Post-win canvas tap: one burst, ~⅓ fewer bits than clear. */
export const TAP_CONFETTI_COUNT = 72;
/** Slightly slower than the clear burst so a tap reads as a smaller pop. */
export const TAP_SPEED_SCALE = 0.85;

/** Constant ripple speed in CSS/world pixels — not a fraction of max radius. */
export const RIPPLE_SPEED_PX_S = 230;
/** Short local pulse once the wavefront reaches a dot. */
export const RIPPLE_PULSE_S = 0.22;
/** Global “Cleared” pop after the wave has swept a typical board. */
export const CLEARED_BURST_AT_S = 1.2;
export const CLEARED_BURST_S = 0.3;

const WIN_BURST_DELAYS_S = [0, 0.18, 0.36] as const;

export type ConfettiBit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  /** Seconds after this FX starts before the bit is born. */
  delay: number;
};

export type WinFx = {
  /** 0..1 over this FX’s duration */
  t: number;
  origin: Point;
  bits: ConfettiBit[];
  durationMs?: number;
};

export type ConfettiSeedOpts = {
  bursts?: number;
  speedScale?: number;
  spread?: number;
};

const CONFETTI = ["#5B6CFF", "#7b8cff", "#c4cbff", "#16161f", "#1b1f33", "#ff4b6a", "#8b90a7"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rippleDelaySec(distPx: number): number {
  return Math.max(0, distPx) / RIPPLE_SPEED_PX_S;
}

export function seedConfetti(
  origin: Point,
  count = WIN_CONFETTI_COUNT,
  seed = 42,
  opts: ConfettiSeedOpts = {},
): ConfettiBit[] {
  const bursts = Math.max(1, Math.min(3, opts.bursts ?? 3));
  const speedScale = opts.speedScale ?? 1;
  const spread = opts.spread ?? 10;
  const rand = mulberry32(seed);
  const bits: ConfettiBit[] = [];
  for (let i = 0; i < count; i++) {
    const burst = i % bursts;
    const ang = rand() * Math.PI * 2;
    const spd = (90 + rand() * 240) * speedScale;
    const ox = burst === 0 ? 0 : (rand() - 0.5) * spread;
    const oy = burst === 0 ? 0 : (rand() - 0.5) * spread;
    bits.push({
      x: origin.x + ox,
      y: origin.y + oy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 80 - rand() * 90,
      rot: rand() * Math.PI,
      vr: (rand() - 0.5) * 10,
      w: 3.2 + rand() * 5.2,
      h: 2 + rand() * 3.4,
      color: CONFETTI[i % CONFETTI.length],
      delay: WIN_BURST_DELAYS_S[burst] ?? 0,
    });
  }
  return bits;
}

export function seedTapConfetti(origin: Point, seed = 1): ConfettiBit[] {
  return seedConfetti(origin, TAP_CONFETTI_COUNT, seed, {
    bursts: 1,
    speedScale: TAP_SPEED_SCALE,
    spread: 0,
  });
}

export function latticeRipple(
  origin: Point,
  p: Point,
  t: number,
  baseR: number,
): { r: number; alpha: number } {
  const elapsed = Math.max(0, t) * (WIN_FX_MS / 1000);
  const dist = Math.hypot(p.x - origin.x, p.y - origin.y);
  const delay = rippleDelaySec(dist);
  const local = elapsed - delay;

  let pulse = 0;
  if (local > 0 && local < RIPPLE_PULSE_S) {
    pulse = Math.sin((local / RIPPLE_PULSE_S) * Math.PI);
  }

  let cleared = 0;
  const clearedLocal = elapsed - CLEARED_BURST_AT_S;
  if (elapsed >= delay && clearedLocal > 0 && clearedLocal < CLEARED_BURST_S) {
    cleared = Math.sin((clearedLocal / CLEARED_BURST_S) * Math.PI);
  }

  const restAlpha = local > 0 ? 0.72 : 0.55;
  return {
    r: baseR * (1 + 2.1 * pulse + 1.15 * cleared),
    alpha: Math.min(1, restAlpha + 0.28 * pulse + 0.22 * cleared),
  };
}

export function drawConfetti(ctx: CanvasRenderingContext2D, fx: WinFx): void {
  const durationSec = (fx.durationMs ?? WIN_FX_MS) / 1000;
  const elapsed = Math.max(0, Math.min(1, fx.t)) * durationSec;
  const g = 420;
  for (const bit of fx.bits) {
    const localSec = elapsed - bit.delay;
    if (localSec <= 0) continue;
    const localT = localSec / durationSec;
    if (localT >= 1) continue;
    const fade = localT < 0.75 ? 1 : 1 - (localT - 0.75) / 0.25;
    const x = bit.x + bit.vx * localT;
    const y = bit.y + bit.vy * localT + 0.5 * g * localT * localT;
    const rot = bit.rot + bit.vr * localT;
    ctx.save();
    ctx.globalAlpha = 0.88 * fade;
    ctx.fillStyle = bit.color;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
    ctx.restore();
  }
}
